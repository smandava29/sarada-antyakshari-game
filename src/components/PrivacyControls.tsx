import { useState } from "react";
import { setAdConsent } from "../lib/adConsent";
import { Modal } from "./Modal";

export function PrivacyControls() {
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const choose = (value: "accepted" | "rejected") => {
    setAdConsent(value);
    setPrivacyOpen(false);
  };

  return (
    <>
      <button className="privacy-link" type="button" onClick={() => setPrivacyOpen(true)}>
        Privacy &amp; ad settings
      </button>

      <Modal title="Privacy and advertising" open={privacyOpen} onClose={() => setPrivacyOpen(false)}>
        <p>
          Ads are enabled by default. You can change that choice here at any time without losing access to the game.
        </p>
        <p>
          If accepted, Google and its advertising partners may process identifiers, device information,
          interactions, approximate location, and ad-performance data under their policies. This application does
          not send your guesses or game progress to Google. Rejecting ads blocks future ad requests and takes full
          effect after a reload.
        </p>
        <div className="consent-actions">
          <button className="secondary-button" type="button" onClick={() => choose("rejected")}>Reject</button>
          <button className="primary-button" type="button" onClick={() => choose("accepted")}>Accept ads</button>
        </div>
      </Modal>
    </>
  );
}
