export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

/**
 * Curated set of accent color keys a poll creator can pick. We store the key
 * (not a raw hex) so we can restyle the palette later without rewriting data.
 * Keep this list in lockstep with the frontend palette.
 */
export const POLL_ACCENT_COLORS = [
  "orange",
  "amber",
  "red",
  "magenta",
  "violet",
  "blue",
  "teal",
  "green",
] as const;

export type PollAccentColor = (typeof POLL_ACCENT_COLORS)[number];

export const DEFAULT_POLL_ACCENT_COLOR: PollAccentColor = "orange";

export function isPollAccentColor(value: unknown): value is PollAccentColor {
  return (
    typeof value === "string" &&
    (POLL_ACCENT_COLORS as readonly string[]).includes(value)
  );
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: string;
  accentColor: PollAccentColor;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
  accentColor: PollAccentColor;
}
