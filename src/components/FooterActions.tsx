import type { ReactNode } from "react";

interface FooterActionsProps {
  children: ReactNode;
}

const songSuggestionsLink =
  import.meta.env.VITE_SONG_SUGGESTIONS_FORM_URL?.trim() ||
  "https://forms.gle/bP68UFeoW1sBLmUH9";

const feedbackLink =
  import.meta.env.VITE_FEEDBACK_FORM_URL?.trim() ||
  "https://forms.gle/ijJYn6snreW9WnpL7";

const donationIcon =
  import.meta.env.VITE_DONATION_ICON_URL?.trim() ||
  "/feedback.gif";

const feedbackIcon =
  import.meta.env.VITE_FEEDBACK_ICON_URL?.trim() ||
  "/suggestions.gif";

export function FooterActions({ children }: FooterActionsProps) {
  return (
    <div
      className="footer-actions"
      aria-label="Song suggestions and feedback"
    >
      <a
        className="footer-gif-button footer-action-left"
        href={feedbackLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Feedback"
        data-tooltip="Feedback"
      >
        <img src={donationIcon} alt="" aria-hidden="true" />
      </a>

      <span className="footer-text">{children}</span>

      <a
        className="footer-gif-button footer-action-right"
        href={songSuggestionsLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Upload Suggestions"
        data-tooltip="Upload Suggestions"
      >
        <img src={feedbackIcon} alt="" aria-hidden="true" />
      </a>
    </div>
  );
}
