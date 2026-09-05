import { gameApi } from "./gameApi";
import type { MediaAsset, SignedMedia } from "../types/game";

const signedMediaCache = new Map<string, SignedMedia>();

function cacheKey(sessionToken: string, asset: MediaAsset): string {
  return `${sessionToken}:${asset}`;
}

function hasSignedUrl(media: SignedMedia | null): media is SignedMedia {
  return Boolean(media?.signedUrl.trim());
}

export function rememberMedia(
  sessionToken: string,
  asset: MediaAsset,
  media: SignedMedia | null,
): void {
  if (hasSignedUrl(media)) {
    signedMediaCache.set(cacheKey(sessionToken, asset), media);
  }
}

export async function getUsableMedia(
  sessionToken: string,
  asset: MediaAsset,
  initialMedia: SignedMedia | null,
  forceRefresh = false,
): Promise<SignedMedia> {
  if (hasSignedUrl(initialMedia)) {
    rememberMedia(sessionToken, asset, initialMedia);
  }

  const key = cacheKey(sessionToken, asset);
  const cached = signedMediaCache.get(key);

  if (!forceRefresh && cached) {
    return cached;
  }

  const refreshed = await gameApi.mediaUrl(sessionToken, asset);

  if (!hasSignedUrl(refreshed)) {
    throw new Error("The media URL is unavailable.");
  }

  signedMediaCache.set(key, refreshed);
  return refreshed;
}

export function clearMediaCache(
  sessionToken?: string,
  asset?: MediaAsset,
): void {
  if (!sessionToken) {
    signedMediaCache.clear();
    return;
  }

  if (asset) {
    signedMediaCache.delete(cacheKey(sessionToken, asset));
    return;
  }

  const prefix = `${sessionToken}:`;

  for (const key of signedMediaCache.keys()) {
    if (key.startsWith(prefix)) {
      signedMediaCache.delete(key);
    }
  }
}
