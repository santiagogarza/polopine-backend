export const ACCENT_COLORS = [
  "orange",
  "red",
  "rose",
  "violet",
  "indigo",
  "teal",
  "green",
  "amber",
] as const;

export type AccentColor = (typeof ACCENT_COLORS)[number];

export const DEFAULT_ACCENT_COLOR: AccentColor = "orange";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  accentColor: AccentColor;
  options: PollOption[];
  createdAt: string;
}

export interface PollResults {
  question: string;
  accentColor: AccentColor;
  options: PollOption[];
  totalVotes: number;
}
