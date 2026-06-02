import { randomUUID } from "node:crypto";
import { DEFAULT_ACCENT_COLOR, type AccentColor } from "./accentColor.js";
import type { Poll, PollOption } from "./types.js";

const polls = new Map<string, Poll>();

export function createPoll(
  question: string,
  optionTexts: string[],
  accentColor: AccentColor = DEFAULT_ACCENT_COLOR,
): Poll {
  const options: PollOption[] = optionTexts.map((text) => ({
    id: randomUUID(),
    text,
    votes: 0,
  }));

  const poll: Poll = {
    id: randomUUID(),
    question,
    options,
    accentColor,
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

const SEED_POLL_DEFS: Array<{
  question: string;
  options: string[];
  accentColor: AccentColor;
}> = [
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
    accentColor: "teal",
  },
  {
    question: "What's your top skill?",
    options: ["Coding", "Design", "ML", "Leading", "Eating all the snacks"],
    accentColor: "violet",
  },
  {
    question: "How much of a Cursor ninja are you?",
    options: [
      "Brand new to Cursor!",
      "1-6 months",
      "6-12 months",
      "Over a year",
    ],
    accentColor: "orange",
  },
];

/** Stable epoch for seeded poll ordering across restarts. */
const SEED_BASE_MS = Date.parse("2024-06-01T12:00:00.000Z");

function insertSeededPoll(
  question: string,
  optionTexts: string[],
  accentColor: AccentColor,
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
    accentColor,
    createdAt,
  };

  polls.set(poll.id, poll);
}

export function seed(): void {
  SEED_POLL_DEFS.forEach((def, index) => {
    const createdAt = new Date(SEED_BASE_MS + index * 60_000).toISOString();
    insertSeededPoll(def.question, def.options, def.accentColor, createdAt);
  });
}

/** Reset store between tests. */
export function clearPolls(): void {
  polls.clear();
}
