import { beforeEach, describe, expect, it } from "vitest";
import * as store from "../src/store.js";

describe("store", () => {
  beforeEach(() => {
    store.clearPolls();
  });

  it("vote returns undefined for missing poll", () => {
    expect(
      store.vote("missing-poll", "missing-option", "voter-1"),
    ).toBeUndefined();
  });

  it("vote returns undefined for missing option on existing poll", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    expect(store.vote(poll.id, "missing-option", "voter-1")).toBeUndefined();
  });

  it("keeps repeat votes from the same voter idempotent", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionId = poll.options[0].id;

    store.vote(poll.id, optionId, "voter-1");
    const updated = store.vote(poll.id, optionId, "voter-1");

    expect(updated?.options.map((option) => option.votes)).toEqual([1, 0]);
  });

  it("moves a voter from their previous option when switching", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const [optionA, optionB] = poll.options;

    store.vote(poll.id, optionA.id, "voter-1");
    const updated = store.vote(poll.id, optionB.id, "voter-1");

    expect(updated?.options.map((option) => option.votes)).toEqual([0, 1]);
  });

  it("clears voter choices when resetting votes", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionId = poll.options[0].id;

    store.vote(poll.id, optionId, "voter-1");
    store.resetPollVotes(poll.id);
    const updated = store.vote(poll.id, optionId, "voter-1");

    expect(updated?.options.map((option) => option.votes)).toEqual([1, 0]);
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
