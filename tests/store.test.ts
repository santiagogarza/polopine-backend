import { beforeEach, describe, expect, it } from "vitest";
import * as store from "../src/store.js";

describe("store", () => {
  beforeEach(() => {
    store.clearPolls();
  });

  const VOTER = "voter-a";

  it("vote returns undefined for missing poll", () => {
    expect(store.vote("missing-poll", "missing-option", VOTER)).toBeUndefined();
  });

  it("vote returns undefined for missing option on existing poll", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    expect(store.vote(poll.id, "missing-option", VOTER)).toBeUndefined();
  });

  it("vote is idempotent when the same voter picks the same option twice", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;

    store.vote(poll.id, optionA, VOTER);
    const updated = store.vote(poll.id, optionA, VOTER);

    expect(updated?.options[0].votes).toBe(1);
    expect(updated?.options[1].votes).toBe(0);
  });

  it("vote switches a voter from one option to another", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    store.vote(poll.id, optionA, VOTER);
    const updated = store.vote(poll.id, optionB, VOTER);

    expect(updated?.options[0].votes).toBe(0);
    expect(updated?.options[1].votes).toBe(1);
  });

  it("two voters voting independently do not affect each other when one switches", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    store.vote(poll.id, optionA, "voter-1");
    store.vote(poll.id, optionB, "voter-2");
    const updated = store.vote(poll.id, optionB, "voter-1");

    expect(updated?.options[0].votes).toBe(0);
    expect(updated?.options[1].votes).toBe(2);
  });

  it("resetPollVotes clears the voter map", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;

    store.vote(poll.id, optionA, VOTER);
    const reset = store.resetPollVotes(poll.id);

    expect(reset?.options.every((o) => o.votes === 0)).toBe(true);
    expect(store.vote(poll.id, optionA, VOTER)?.options[0].votes).toBe(1);
  });

  it("deletePoll returns false for missing poll", () => {
    expect(store.deletePoll("missing-poll")).toBe(false);
  });

  it("resetPollVotes returns undefined for missing poll", () => {
    expect(store.resetPollVotes("missing-poll")).toBeUndefined();
  });

  it("seed produces stable poll ordering by createdAt descending", () => {
    store.seed();

    const polls = store.listPolls();

    expect(polls).toHaveLength(3);
    expect(polls[0].question).toBe("How much of a Cursor ninja are you?");
    expect(polls[1].question).toBe("What's your top skill?");
    expect(polls[2].question).toBe("What continent are you from?");

    for (let i = 0; i < polls.length - 1; i++) {
      expect(polls[i].createdAt >= polls[i + 1].createdAt).toBe(true);
    }
  });
});
