import { describe, expect, it } from "vitest";
import { encodeBase64Url } from "./crypto";
import { createMediaToken, readMediaToken } from "./media-token";

const secret = encodeBase64Url(new Uint8Array(32).fill(7));
const sessionHash = "a".repeat(64);

describe("media token", () => {
  it("round-trips an authorized asset without exposing its R2 path", async () => {
    const token = await createMediaToken(secret, sessionHash, "cover", 2_000);
    expect(token).not.toContain("covers/");
    await expect(readMediaToken(secret, token, 1_000)).resolves.toEqual({
      version: 1,
      sessionHash,
      asset: "cover",
      expiresAt: 2_000,
    });
  });

  it("rejects expired and modified tokens", async () => {
    const token = await createMediaToken(secret, sessionHash, "preview", 2_000);
    await expect(readMediaToken(secret, token, 2_000)).rejects.toMatchObject({
      code: "MEDIA_TOKEN_EXPIRED",
    });
    const mutationIndex = 20;
    const replacement = token[mutationIndex] === "a" ? "b" : "a";
    const modified =
      `${token.slice(0, mutationIndex)}${replacement}${token.slice(mutationIndex + 1)}`;
    await expect(readMediaToken(secret, modified, 1_000)).rejects.toMatchObject({
      code: "INVALID_MEDIA_TOKEN",
    });
  });
});
