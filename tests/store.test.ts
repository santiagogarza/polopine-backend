import { beforeEach, describe, expect, it } from "vitest";
import * as store from "../src/store.js";

describe("store", () => {
  beforeEach(() => {
    store.clearPolls();
  });

  it("vote returns undefined for missing poll", () => {
    expect(store.vote("missing-poll", "missing-option")).toBeUndefined();
  });

  it("vote returns undefined for missing option on existing poll", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    expect(store.vote(poll.id, "missing-option")).toBeUndefined();
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
