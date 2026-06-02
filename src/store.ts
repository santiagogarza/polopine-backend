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
    createdAt: new Date().toISOString(),
    allowVoterOptions: true,
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

/**
 * Result envelope for {@link addOption}. Lets the route layer translate
 * store-level reasons into the right HTTP status code without throwing.
 */
export type AddOptionResult =
  | { ok: true; poll: Poll }
  | {
      ok: false;
      reason: "not_found" | "disabled" | "duplicate";
    };

export function addOption(
  pollId: string,
  text: string,
  voterId: string,
): AddOptionResult {
  const poll = polls.get(pollId);
  if (!poll) {
    return { ok: false, reason: "not_found" };
  }
  if (!poll.allowVoterOptions) {
    return { ok: false, reason: "disabled" };
  }

  const normalized = text.toLowerCase();
  const duplicate = poll.options.some(
    (o) => o.text.toLowerCase() === normalized,
  );
  if (duplicate) {
    return { ok: false, reason: "duplicate" };
  }

  const option: PollOption = {
    id: randomUUID(),
    text,
    votes: 0,
    authorVoterId: voterId,
  };
  poll.options.push(option);
  return { ok: true, poll };
}

/**
 * Removes an option from a poll. Returns the updated poll, or `undefined`
 * if the poll doesn't exist. Returns `{ poll, removed: false }` shape via
 * the discriminated union below when the option id wasn't on the poll —
 * letting the route layer choose 404 vs 200.
 */
export type RemoveOptionResult =
  | { ok: true; poll: Poll }
  | { ok: false; reason: "poll_not_found" | "option_not_found" };

export function removeOption(
  pollId: string,
  optionId: string,
): RemoveOptionResult {
  const poll = polls.get(pollId);
  if (!poll) {
    return { ok: false, reason: "poll_not_found" };
  }

  const index = poll.options.findIndex((o) => o.id === optionId);
  if (index === -1) {
    return { ok: false, reason: "option_not_found" };
  }

  poll.options.splice(index, 1);
  return { ok: true, poll };
}

export function setAllowVoterOptions(
  pollId: string,
  allow: boolean,
): Poll | undefined {
  const poll = polls.get(pollId);
  if (!poll) {
    return undefined;
  }
  poll.allowVoterOptions = allow;
  return poll;
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
}
