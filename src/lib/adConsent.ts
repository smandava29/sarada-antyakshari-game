export type AdConsent = "accepted" | "rejected" | null;

const STORAGE_KEY = "SA_ads_consent_v1";
export const AD_CONSENT_EVENT = "SA:ad-consent-change";

export function getAdConsent(): AdConsent {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "rejected" ? value : null;
  } catch {
    return null;
  }
}

export function setAdConsent(value: Exclude<AdConsent, null>): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Keep the in-page choice when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent(AD_CONSENT_EVENT, { detail: value }));
}
