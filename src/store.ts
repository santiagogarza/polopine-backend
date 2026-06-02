import { randomUUID } from "node:crypto";
import type { Poll, PollOption } from "./types.js";
import { MAX_OPTIONS_PER_POLL } from "./types.js";

const polls = new Map<string, Poll>();

/**
 * Outcome codes for option mutations (POL-10). Routes translate these into
 * HTTP responses; the store stays HTTP-agnostic so it stays unit-testable.
 */
export type AddOptionError =
  | "poll_not_found"
  | "duplicate"
  | "too_many_options";

export type DeleteOptionError =
  | "poll_not_found"
  | "option_not_found"
  | "forbidden"
  | "has_votes"
  | "would_leave_too_few_options";

export type AddOptionResult =
  | { ok: true; poll: Poll }
  | { ok: false; error: AddOptionError };

export type DeleteOptionResult =
  | { ok: true; poll: Poll }
  | { ok: false; error: DeleteOptionError };

function normalizeForDuplicateCheck(text: string): string {
  return text.trim().toLowerCase();
}

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

/**
 * Adds a voter-authored option to an existing poll (POL-10).
 *
 * Pre-conditions enforced here (HTTP-shape decisions live in `app.ts`):
 * - poll must exist
 * - trimmed text must not duplicate any existing option in the same poll
 *   (case-insensitive)
 * - poll must have fewer than `MAX_OPTIONS_PER_POLL` options
 *
 * Text length / blank checks happen in the route handler so we can return
 * 400 with a precise message before reaching the store.
 */
export function addOption(
  pollId: string,
  text: string,
  authorId: string,
): AddOptionResult {
  const poll = polls.get(pollId);
  if (!poll) {
    return { ok: false, error: "poll_not_found" };
  }

  const trimmed = text.trim();
  const normalized = normalizeForDuplicateCheck(trimmed);
  const isDuplicate = poll.options.some(
    (o) => normalizeForDuplicateCheck(o.text) === normalized,
  );
  if (isDuplicate) {
    return { ok: false, error: "duplicate" };
  }

  if (poll.options.length >= MAX_OPTIONS_PER_POLL) {
    return { ok: false, error: "too_many_options" };
  }

  const option: PollOption = {
    id: randomUUID(),
    text: trimmed,
    votes: 0,
    authorId,
  };
  poll.options.push(option);
  return { ok: true, poll };
}

/**
 * Deletes an option from a poll (POL-10).
 *
 * Authorization model:
 * - admins (`isAdmin: true`) can delete any option that has no votes
 * - voters can only delete options they authored (option.authorId === voterId)
 * - options with no `authorId` (poll-creation / seeded) are admin-only
 *
 * Always-on invariants (apply to admins too):
 * - cannot delete an option that has any recorded votes (`has_votes`)
 * - cannot drop a poll below 2 options (`would_leave_too_few_options`)
 */
export function deleteOption(
  pollId: string,
  optionId: string,
  opts: { voterId?: string; isAdmin: boolean },
): DeleteOptionResult {
  const poll = polls.get(pollId);
  if (!poll) {
    return { ok: false, error: "poll_not_found" };
  }

  const index = poll.options.findIndex((o) => o.id === optionId);
  if (index === -1) {
    return { ok: false, error: "option_not_found" };
  }

  const option = poll.options[index];
  const isAuthor =
    typeof option.authorId === "string" &&
    typeof opts.voterId === "string" &&
    option.authorId === opts.voterId;

  if (!opts.isAdmin && !isAuthor) {
    return { ok: false, error: "forbidden" };
  }

  if (option.votes > 0) {
    return { ok: false, error: "has_votes" };
  }

  if (poll.options.length <= 2) {
    return { ok: false, error: "would_leave_too_few_options" };
  }

  poll.options.splice(index, 1);
  return { ok: true, poll };
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
  }));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
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
