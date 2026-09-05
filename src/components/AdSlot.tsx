import {
  useEffect,
  useRef,
} from "react";
import { adsConfig } from "../lib/adsConfig";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdFormat =
  | "horizontal"
  | "vertical"
  | "rectangle"
  | "auto";

interface AdSlotProps {
  slot?: string;
  format: AdFormat;
  className?: string;
  fullWidthResponsive?: boolean;
  previewLabel: string;
}

export function AdSlot({
  slot,
  format,
  className = "",
  fullWidthResponsive = false,
  previewLabel,
}: AdSlotProps) {
  const adRef =
    useRef<HTMLModElement | null>(null);

  const configured =
    adsConfig.loadRealAds &&
    Boolean(adsConfig.client) &&
    Boolean(slot?.trim());

  useEffect(() => {
    if (!configured) {
      return;
    }

    const element = adRef.current;

    /*
     * Avoid initializing the same ad element twice,
     * including during React re-renders.
     */
    if (
      !element ||
      element.dataset
        .adsbygoogleStatus
    ) {
      return;
    }

    try {
      (
        window.adsbygoogle =
          window.adsbygoogle || []
      ).push({});
    } catch (error) {
      console.error("Unable to initialize AdSense slot.", error);
    }
  }, [configured, slot]);

  if (!configured) {
    /*
     * Development-only layout preview.
     * No real advertisement is requested.
     */
    if (import.meta.env.DEV) {
      return (
        <div
          className={
            `ad-placeholder ${className}`
          }
          aria-hidden="true"
        >
          {previewLabel}
        </div>
      );
    }

    return null;
  }

  return (
    <ins
      ref={adRef}
      className={
        `adsbygoogle ${className}`
      }
      style={{
        display: "block",
      }}
      data-ad-client={
        adsConfig.client
      }
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={
        fullWidthResponsive
          ? "true"
          : "false"
      }
    />
  );
}