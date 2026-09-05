import { useEffect, useState } from "react";
import { AD_CONSENT_EVENT, getAdConsent, setAdConsent, type AdConsent } from "../lib/adConsent";
import { adsConfig } from "../lib/adsConfig";
import { Modal } from "./Modal";

export function PrivacyControls() {
  const [consent, updateConsent] = useState<AdConsent>(() => getAdConsent());
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    const onChange = (event: Event) => updateConsent((event as CustomEvent<AdConsent>).detail);
    window.addEventListener(AD_CONSENT_EVENT, onChange);
    return () => window.removeEventListener(AD_CONSENT_EVENT, onChange);
  }, []);

  const choose = (value: "accepted" | "rejected") => {
    updateConsent(value);
    setAdConsent(value);
    setPrivacyOpen(false);
  };

  return (
    <>
      {adsConfig.loadRealAds && consent === null && (
        <section className="consent-banner" role="dialog" aria-label="Advertising privacy choice">
          <p>
            With your permission, Google AdSense may store or access device identifiers and process device,
            interaction, approximate-location, and advertising data. You can reject ads without losing access to
            the game. Google remains blocked until you accept.
          </p>
          <div className="consent-actions">
            <button className="secondary-button" type="button" onClick={() => choose("rejected")}>Reject</button>
            <button className="primary-button" type="button" onClick={() => choose("accepted")}>Accept ads</button>
          </div>
        </section>
      )}

      <button className="privacy-link" type="button" onClick={() => setPrivacyOpen(true)}>
        Privacy &amp; ad settings
      </button>

      <Modal title="Privacy and advertising" open={privacyOpen} onClose={() => setPrivacyOpen(false)}>
        <p>The game does not contact Google or permit advertising storage unless you explicitly accept ads.</p>
        <p>
          If accepted, Google and its advertising partners may process identifiers, device information,
          interactions, approximate location, and ad-performance data under their policies. This application does
          not send your guesses or game progress to Google. Withdrawal blocks future ad requests and takes full
          effect after a reload.
        </p>
        <div className="consent-actions">
          <button className="secondary-button" type="button" onClick={() => choose("rejected")}>Reject / withdraw</button>
          <button className="primary-button" type="button" onClick={() => choose("accepted")}>Accept ads</button>
        </div>
      </Modal>
    </>
  );
}
