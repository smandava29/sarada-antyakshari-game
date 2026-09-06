import type { MediaAsset } from "../types";
import { decodeBase64Url, encodeBase64Url } from "./crypto";
import { ApiError } from "./errors";

const IV_BYTES = 12;
const TOKEN_VERSION = 1;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const additionalData = encoder.encode("sa-media-token-v1");

interface MediaTokenPayload {
  version: number;
  sessionHash: string;
  asset: MediaAsset;
  expiresAt: number;
}

const MEDIA_ASSETS = new Set<MediaAsset>([
  "question",
  "preview",
  "cover",
]);

async function importKey(encodedSecret: string | undefined): Promise<CryptoKey> {
  if (!encodedSecret?.trim()) {
    throw new ApiError(
      500,
      "INVALID_CONFIGURATION",
      "MEDIA_TOKEN_SECRET is not configured.",
    );
  }

  const keyBytes = decodeBase64Url(encodedSecret.trim());
  if (keyBytes.byteLength !== 32) {
    throw new ApiError(
      500,
      "INVALID_CONFIGURATION",
      "MEDIA_TOKEN_SECRET must decode to exactly 32 bytes.",
    );
  }
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function createMediaToken(
  secret: string,
  sessionHash: string,
  asset: MediaAsset,
  expiresAt: number,
): Promise<string> {
  const payload: MediaTokenPayload = {
    version: TOKEN_VERSION,
    sessionHash,
    asset,
    expiresAt,
  };
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await importKey(secret),
    encoder.encode(JSON.stringify(payload)),
  );
  const token = new Uint8Array(IV_BYTES + encrypted.byteLength);
  token.set(iv, 0);
  token.set(new Uint8Array(encrypted), IV_BYTES);
  return encodeBase64Url(token);
}

export async function readMediaToken(
  secret: string,
  token: string,
  now: number,
): Promise<MediaTokenPayload> {
  try {
    const bytes = decodeBase64Url(token);
    if (bytes.byteLength <= IV_BYTES + 16) throw new Error("Token is too short.");

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: bytes.slice(0, IV_BYTES), additionalData },
      await importKey(secret),
      bytes.slice(IV_BYTES),
    );
    const parsed = JSON.parse(decoder.decode(decrypted)) as Partial<MediaTokenPayload>;
    if (
      parsed.version !== TOKEN_VERSION ||
      typeof parsed.sessionHash !== "string" ||
      !/^[a-f0-9]{64}$/u.test(parsed.sessionHash) ||
      typeof parsed.asset !== "string" ||
      !MEDIA_ASSETS.has(parsed.asset as MediaAsset) ||
      !Number.isSafeInteger(parsed.expiresAt)
    ) {
      throw new Error("Token payload is invalid.");
    }
    if ((parsed.expiresAt as number) <= now) {
      throw new ApiError(401, "MEDIA_TOKEN_EXPIRED", "The media link has expired.");
    }
    return parsed as MediaTokenPayload;
  } catch (error) {
    if (error instanceof ApiError && error.code === "MEDIA_TOKEN_EXPIRED") throw error;
    if (error instanceof ApiError && error.code === "INVALID_CONFIGURATION") throw error;
    throw new ApiError(401, "INVALID_MEDIA_TOKEN", "The media link is invalid or expired.");
  }
}
