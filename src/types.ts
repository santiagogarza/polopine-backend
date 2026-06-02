import type { AccentColor } from "./accentColor.js";

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  accentColor: AccentColor;
  createdAt: string;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
  accentColor: AccentColor;
}
