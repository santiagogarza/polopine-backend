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

  it("addOption rejects duplicate text case-insensitively", () => {
    const poll = store.createPoll("Q?", ["Yes", "No"]);

    expect(store.addOption(poll.id, "YES", "voter-1")).toBe("duplicate");
  });

  it("deleteOption removes voter map entries for that option", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    store.vote(poll.id, optionA, "voter-1");
    store.vote(poll.id, optionB, "voter-2");

    store.deleteOption(poll.id, optionA);

    const updated = store.getPoll(poll.id)!;
    expect(updated.options).toHaveLength(1);
    expect(updated.options[0].id).toBe(optionB);
  });
});
