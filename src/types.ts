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
  /** voterId → optionId; internal only, omitted from JSON responses */
  voters: Map<string, string>;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
}
