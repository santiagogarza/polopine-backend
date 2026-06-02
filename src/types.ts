export interface PollOption {
  id: string;
  text: string;
  votes: number;
  authorVoterId: string | null;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  createdAt: string;
  allowVoterOptions: boolean;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  totalVotes: number;
}
