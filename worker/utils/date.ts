import { ApiError } from "./errors";

const GAME_TIME_ZONE = "Asia/Kolkata";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1_000);
}

export function todayInIndia(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: GAME_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function previousIsoDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day));
  instant.setUTCDate(instant.getUTCDate() - 1);
  return instant.toISOString().slice(0, 10);
}

export function validateIsoDate(value: unknown, field = "questionDate"): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new ApiError(400, "INVALID_DATE", `${field} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== value) {
    throw new ApiError(400, "INVALID_DATE", `${field} is not a real calendar date.`);
  }
  return value;
}
