import { randomUUID } from "node:crypto";
import type { Poll, PollOption } from "./types.js";

/** In-memory poll with per-voter choice tracking for vote changes (POL-7). */
interface StoredPoll extends Poll {
  voters: Map<string, string>;
}

const polls = new Map<string, StoredPoll>();

function toPublicPoll(poll: StoredPoll): Poll {
  return {
    id: poll.id,
    question: poll.question,
    options: poll.options,
    createdAt: poll.createdAt,
  };
}

export function createPoll(question: string, optionTexts: string[]): Poll {
  const options: PollOption[] = optionTexts.map((text) => ({
    id: randomUUID(),
    text,
    votes: 0,
  }));

  const poll: StoredPoll = {
    id: randomUUID(),
    question,
    options,
    createdAt: new Date().toISOString(),
    voters: new Map(),
  };

  polls.set(poll.id, poll);
  return toPublicPoll(poll);
}

export function getPoll(id: string): Poll | undefined {
  const poll = polls.get(id);
  return poll ? toPublicPoll(poll) : undefined;
}

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

  const priorOptionId = poll.voters.get(voterId);
  if (priorOptionId === optionId) {
    return toPublicPoll(poll);
  }

  if (priorOptionId) {
    const priorOption = poll.options.find((o) => o.id === priorOptionId);
    if (priorOption) {
      priorOption.votes -= 1;
    }
  } else {
    option.votes += 1;
  }

  if (priorOptionId) {
    option.votes += 1;
  }

  poll.voters.set(voterId, optionId);
  return toPublicPoll(poll);
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
  poll.voters.clear();

  return toPublicPoll(poll);
}

export function listPolls(): Poll[] {
  return [...polls.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toPublicPoll);
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

  const poll: StoredPoll = {
    id: randomUUID(),
    question,
    options,
    createdAt,
    voters: new Map(),
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
