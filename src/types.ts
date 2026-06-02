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
  allowVoterOptions: boolean;
  createdAt: string;
}

export interface PollResults {
  question: string;
  options: PollOption[];
  allowVoterOptions: boolean;
  totalVotes: number;
}
