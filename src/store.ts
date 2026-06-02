import { randomUUID } from "node:crypto";
import type { Poll, PollOption } from "./types.js";

const polls = new Map<string, Poll>();

export function createPoll(question: string, optionTexts: string[]): Poll {
  const options: PollOption[] = optionTexts.map((text) => ({
    id: randomUUID(),
    text,
    votes: 0,
    authorVoterId: null,
  }));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    allowVoterOptions: true,
    createdAt: new Date().toISOString(),
  };

  polls.set(poll.id, poll);
  return poll;
}

export function getPoll(id: string): Poll | undefined {
  return polls.get(id);
}

export function vote(pollId: string, optionId: string): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) {
    return undefined;
  }

  option.votes += 1;
  return poll;
}

export function addOption(
  pollId: string,
  text: string,
  authorVoterId: string,
): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  poll.options.push({
    id: randomUUID(),
    text,
    votes: 0,
    authorVoterId,
  });
  return poll;
}

export function deleteOption(pollId: string, optionId: string): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  const optionIndex = poll.options.findIndex((option) => option.id === optionId);
  if (optionIndex === -1) {
    return undefined;
  }

  poll.options.splice(optionIndex, 1);
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
  const options: PollOption[] = optionTexts.map((text) => ({
    id: randomUUID(),
    text,
    votes: 0,
    authorVoterId: null,
  }));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    allowVoterOptions: true,
    createdAt,
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
}
