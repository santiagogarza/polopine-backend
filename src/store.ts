import { randomUUID } from "node:crypto";
import type { Poll, PollOption } from "./types.js";

const polls = new Map<string, Poll>();

// Parallel map kept alongside `polls` so the on-the-wire Poll shape stays
// JSON-friendly (Map values stringify to `{}`). Keyed by pollId -> voterId ->
// optionId, this lets `vote(...)` upsert a voter's choice for POL-7 without
// double-counting or orphaning votes when a voter changes their mind.
const pollVoters = new Map<string, Map<string, string>>();

export function createPoll(question: string, optionTexts: string[]): Poll {
  const options: PollOption[] = optionTexts.map((text) => ({
    id: randomUUID(),
    text,
    votes: 0,
  }));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    createdAt: new Date().toISOString(),
  };

  polls.set(poll.id, poll);
  pollVoters.set(poll.id, new Map());
  return poll;
}

export function getPoll(id: string): Poll | undefined {
  return polls.get(id);
}

/**
 * Upserts the given voter's choice on a poll.
 *
 * - First vote: increments the chosen option and records the voter.
 * - Same option as before: no-op (idempotent — guards against rapid
 *   double-clicks on the "Vote for this instead" affordance).
 * - Different option: decrements the previous option, increments the new
 *   one, and updates the voter's recorded choice. Safe in single-threaded
 *   Node because both reads and writes happen synchronously.
 */
export function vote(
  pollId: string,
  optionId: string,
  voterId: string,
): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) {
    return undefined;
  }

  let voters = pollVoters.get(pollId);
  if (!voters) {
    voters = new Map();
    pollVoters.set(pollId, voters);
  }

  const previousOptionId = voters.get(voterId);
  if (previousOptionId === optionId) {
    return poll;
  }

  if (previousOptionId !== undefined) {
    const previousOption = poll.options.find((o) => o.id === previousOptionId);
    if (previousOption && previousOption.votes > 0) {
      previousOption.votes -= 1;
    }
  }

  option.votes += 1;
  voters.set(voterId, optionId);
  return poll;
}

export function deletePoll(id: string): boolean {
  pollVoters.delete(id);
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

  pollVoters.set(id, new Map());

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
  }));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    createdAt,
  };

  polls.set(poll.id, poll);
  pollVoters.set(poll.id, new Map());
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
  pollVoters.clear();
}
