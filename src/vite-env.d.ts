/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_ENABLED?: string;
  readonly VITE_ADSENSE_PRIVACY_REVIEWED?: string;
  readonly VITE_ADSENSE_TEST_MODE?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_LEFT_SLOT?: string;
  readonly VITE_ADSENSE_RIGHT_SLOT?: string;
  readonly VITE_ADSENSE_BOTTOM_SLOT?: string;

  readonly VITE_FEEDBACK_FORM_URL?: string;
  readonly VITE_SONG_SUGGESTIONS_FORM_URL?: string;
  readonly VITE_DONATION_ICON_URL?: string;
  readonly VITE_FEEDBACK_ICON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
