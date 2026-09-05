import {
  type ReactNode,
  useEffect,
  useState,
} from "react";

import '../AdsLayout.css';
import { AdSlot } from "./AdSlot";
import { adsConfig } from "../lib/adsConfig";
import { AD_CONSENT_EVENT, getAdConsent } from "../lib/adConsent";

interface AdsLayoutProps {
  children: ReactNode;
}

const SIDE_AD_QUERY =
  "(min-width: 1320px)";

function useShowSideAds(): boolean {
  const [
    showSideAds,
    setShowSideAds,
  ] = useState(false);

  useEffect(() => {
    const query =
      window.matchMedia(
        SIDE_AD_QUERY,
      );

    const update = () => {
      setShowSideAds(
        query.matches,
      );
    };

    update();
    query.addEventListener(
      "change",
      update,
    );

    return () => {
      query.removeEventListener(
        "change",
        update,
      );
    };
  }, []);

  return showSideAds;
}

export function AdsLayout({
  children,
}: AdsLayoutProps) {
  const showSideAds =
    useShowSideAds();
  const [hasAdConsent, setHasAdConsent] = useState(() => getAdConsent() === "accepted");

  useEffect(() => {
    const updateConsent = (event: Event) =>
      setHasAdConsent((event as CustomEvent<"accepted" | "rejected">).detail === "accepted");
    window.addEventListener(AD_CONSENT_EVENT, updateConsent);
    return () => window.removeEventListener(AD_CONSENT_EVENT, updateConsent);
  }, []);

  useEffect(() => {
    if (!adsConfig.loadRealAds || !adsConfig.client || !hasAdConsent) {
      return;
    }

    const scriptId = "google-adsense-script";
    if (document.getElementById(scriptId)) {
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src =
      `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsConfig.client)}`;
    document.head.append(script);
    return () => script.remove();
  }, [hasAdConsent]);

  if (!adsConfig.showLayout || (adsConfig.loadRealAds && !hasAdConsent)) {
    return <>{children}</>;
  }

  return (
    <div className="site-ad-layout">
      {showSideAds && (
        <aside
          className={
            "ad-rail ad-rail-left"
          }
          aria-label="Advertisement"
        >
          <AdSlot
            slot={adsConfig.leftSlot}
            format="vertical"
            className={
              "side-ad-unit"
            }
            previewLabel="Left advertisement"
          />
        </aside>
      )}

      <div
        className={
          "site-ad-layout-content"
        }
      >
        {children}

        <aside
          className="bottom-ad-region"
          aria-label="Advertisement"
        >
          <AdSlot
            slot={adsConfig.bottomSlot}
            format="horizontal"
            className={
              "bottom-ad-unit"
            }
            fullWidthResponsive
            previewLabel="Bottom advertisement"
          />
        </aside>
      </div>

      {showSideAds && (
        <aside
          className={
            "ad-rail ad-rail-right"
          }
          aria-label="Advertisement"
        >
          <AdSlot
            slot={adsConfig.rightSlot}
            format="vertical"
            className={
              "side-ad-unit"
            }
            previewLabel="Right advertisement"
          />
        </aside>
      )}
    </div>
  );
}
