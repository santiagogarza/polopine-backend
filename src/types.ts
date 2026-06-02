export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: string;
  /** voterId → optionId for change-vote / one-vote-per-voter semantics */
  voters: Map<string, string>;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
}
