export interface PollOption {
  id: string;
  text: string;
  votes: number;
  /**
   * The voter id (POL-11 `x-voter-id`) of whoever added this option.
   * `null` for options seeded at poll creation time by the creator.
   * Used by the client to render a subtle "added by you" attribution.
   */
  authorVoterId: string | null;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: string;
  /**
   * When true (default), voters can append new options via
   * `POST /polls/:id/options`. The creator/admin can toggle this off
   * per poll without losing existing voter-added options.
   */
  allowVoterOptions: boolean;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
}
