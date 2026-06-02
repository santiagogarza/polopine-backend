import { randomUUID } from "node:crypto";
import type { Poll, PollOption } from "./types.js";

const polls = new Map<string, Poll>();

/** pollId → voterId → optionId (POL-7 change-vote primitive) */
const voters = new Map<string, Map<string, string>>();

export const MAX_OPTION_TEXT_LENGTH = 80;

function makeOption(text: string, authorVoterId: string | null = null): PollOption {
  return {
    id: randomUUID(),
    text,
    votes: 0,
    authorVoterId,
  };
}

function normalizeOptionText(text: string): string {
  return text.trim().toLowerCase();
}

export function hasDuplicateOptionText(
  options: PollOption[],
  text: string,
): boolean {
  const normalized = normalizeOptionText(text);
  return options.some((o) => normalizeOptionText(o.text) === normalized);
}

export function createPoll(question: string, optionTexts: string[]): Poll {
  const options: PollOption[] = optionTexts.map((text) => makeOption(text, null));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    createdAt: new Date().toISOString(),
    allowVoterOptions: true,
  };

  polls.set(poll.id, poll);
  return poll;
}

export function getPoll(id: string): Poll | undefined {
  return polls.get(id);
}

export function vote(
  pollId: string,
  optionId: string,
  voterId?: string,
): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) {
    return undefined;
  }

  option.votes += 1;

  if (voterId) {
    let pollVoters = voters.get(pollId);
    if (!pollVoters) {
      pollVoters = new Map();
      voters.set(pollId, pollVoters);
    }
    pollVoters.set(voterId, optionId);
  }

  return poll;
}

export function addOption(
  pollId: string,
  text: string,
  authorVoterId: string,
): Poll | "not_found" | "disabled" | "duplicate" | "invalid" {
  const poll = polls.get(pollId);
  if (!poll) {
    return "not_found";
  }

  if (!poll.allowVoterOptions) {
    return "disabled";
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "invalid";
  }

  if (trimmed.length > MAX_OPTION_TEXT_LENGTH) {
    return "invalid";
  }

  if (hasDuplicateOptionText(poll.options, trimmed)) {
    return "duplicate";
  }

  poll.options.push(makeOption(trimmed, authorVoterId));
  return poll;
}

export function deleteOption(
  pollId: string,
  optionId: string,
): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  const index = poll.options.findIndex((o) => o.id === optionId);
  if (index === -1) {
    return undefined;
  }

  poll.options.splice(index, 1);

  const pollVoters = voters.get(pollId);
  if (pollVoters) {
    for (const [voterId, votedOptionId] of pollVoters) {
      if (votedOptionId === optionId) {
        pollVoters.delete(voterId);
      }
    }
  }

  return poll;
}

export function setAllowVoterOptions(
  pollId: string,
  allowVoterOptions: boolean,
): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  poll.allowVoterOptions = allowVoterOptions;
  return poll;
}

export function deletePoll(id: string): boolean {
  voters.delete(id);
  return polls.delete(id);
}

export function resetPollVotes(id: string): Poll | undefined {
  const poll = polls.get(id);
  if (!poll) {
    return undefined;
  }

  for (const option of poll.options) {
    option.votes = 0;
  }

  voters.delete(id);

  return poll;
}

export function listPolls(): Poll[] {
  return [...polls.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

const SEED_POLL_DEFS: Array<{ question: string; options: string[] }> = [
  {
    question: "What continent are you from?",
    options: [
      "North America",
      "South America",
      "Europe",
      "Asia",
      "Africa",
      "Antarctica",
      "Oceania",
    ],
  },
  {
    question: "What's your top skill?",
    options: ["Coding", "Design", "ML", "Leading", "Eating all the snacks"],
  },
  {
    question: "How much of a Cursor ninja are you?",
    options: [
      "Brand new to Cursor!",
      "1-6 months",
      "6-12 months",
      "Over a year",
    ],
  },
];

/** Stable epoch for seeded poll ordering across restarts. */
const SEED_BASE_MS = Date.parse("2024-06-01T12:00:00.000Z");

function insertSeededPoll(
  question: string,
  optionTexts: string[],
  createdAt: string,
): void {
  const options: PollOption[] = optionTexts.map((text) => makeOption(text, null));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    createdAt,
    allowVoterOptions: true,
  };

  polls.set(poll.id, poll);
}

export function seed(): void {
  SEED_POLL_DEFS.forEach((def, index) => {
    const createdAt = new Date(SEED_BASE_MS + index * 60_000).toISOString();
    insertSeededPoll(def.question, def.options, createdAt);
  });
}

/** Reset store between tests. */
export function clearPolls(): void {
  polls.clear();
  voters.clear();
}
