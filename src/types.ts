export interface PollOption {
  id: string;
  text: string;
  votes: number;
  /**
   * Opaque voter id of the option's author (POL-10). Omitted for options that
   * were created at poll-creation time or by the seed: those belong to the
   * poll owner / system and have no individual voter author.
   */
  authorId?: string;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: string;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
}

/** Hard caps shared by `app.ts`, `store.ts`, and tests (POL-10). */
export const MAX_OPTIONS_PER_POLL = 12;
export const MAX_OPTION_TEXT_LENGTH = 80;
