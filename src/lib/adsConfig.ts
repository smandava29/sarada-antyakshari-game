const explicitlyEnabled =
  import.meta.env.VITE_ADSENSE_ENABLED === "true";

const privacyReviewed =
  import.meta.env.VITE_ADSENSE_PRIVACY_REVIEWED === "true";

const testMode =
  import.meta.env.MODE === "ads-test" ||
  import.meta.env.VITE_ADSENSE_TEST_MODE === "true";

export const adsConfig = {
  client: import.meta.env.VITE_ADSENSE_CLIENT?.trim(),
  leftSlot: import.meta.env.VITE_ADSENSE_LEFT_SLOT?.trim(),
  rightSlot: import.meta.env.VITE_ADSENSE_RIGHT_SLOT?.trim(),
  bottomSlot: import.meta.env.VITE_ADSENSE_BOTTOM_SLOT?.trim(),
  testMode,
  showLayout: explicitlyEnabled || testMode,
  loadRealAds: explicitlyEnabled && privacyReviewed && !testMode,
};
