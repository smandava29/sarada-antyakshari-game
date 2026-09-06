import { useEffect, useState, type CSSProperties } from "react";

const celebrationPrefix = "saradaga-antyakshari-celebrated";
const particleColors = ["#d7a653", "#f3d28a", "#d86555", "#72b58f", "#a58bd4"];

function hasCelebrated(questionDate: string): boolean {
  try {
    return window.sessionStorage.getItem(`${celebrationPrefix}:${questionDate}`) === "true";
  } catch {
    return false;
  }
}

function rememberCelebration(questionDate: string): void {
  try {
    window.sessionStorage.setItem(`${celebrationPrefix}:${questionDate}`, "true");
  } catch {
    // The animation remains safe when browser storage is unavailable.
  }
}

export function ConfettiCelebration({ questionDate }: { questionDate: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (hasCelebrated(questionDate)) return;

    rememberCelebration(questionDate);
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 2_200);
    return () => window.clearTimeout(timer);
  }, [questionDate]);

  if (!visible) return null;

  return (
    <div className="confetti-celebration" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <span
          className="confetti-piece"
          key={index}
          style={{
            "--burst-angle": `${(index / 28) * 360}deg`,
            "--burst-distance": `${168 + (index % 5) * 44}px`,
            animationDelay: `${(index % 4) * 25}ms`,
            backgroundColor: particleColors[index % particleColors.length],
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
