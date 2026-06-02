import { beforeEach, describe, expect, it } from "vitest";
import * as store from "../src/store.js";

describe("store", () => {
  beforeEach(() => {
    store.clearPolls();
  });

  it("vote returns undefined for missing poll", () => {
    expect(store.vote("missing-poll", "missing-option", "v1")).toBeUndefined();
  });

  it("vote returns undefined for missing option on existing poll", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    expect(store.vote(poll.id, "missing-option", "v1")).toBeUndefined();
  });

  it("vote twice for same option is idempotent", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optA = poll.options[0].id;

    store.vote(poll.id, optA, "voter-1");
    store.vote(poll.id, optA, "voter-1");

    const updated = store.getPoll(poll.id)!;
    expect(updated.options[0].votes).toBe(1);
    expect(updated.options[1].votes).toBe(0);
    expect(updated.voters.size).toBe(1);
  });

  it("vote switch decrements old option and increments new", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optA = poll.options[0].id;
    const optB = poll.options[1].id;

    store.vote(poll.id, optA, "voter-1");
    store.vote(poll.id, optB, "voter-1");

    const updated = store.getPoll(poll.id)!;
    expect(updated.options[0].votes).toBe(0);
    expect(updated.options[1].votes).toBe(1);
    expect(updated.voters.get("voter-1")).toBe(optB);
  });

  it("two voters each vote once without affecting each other", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optA = poll.options[0].id;
    const optB = poll.options[1].id;

    store.vote(poll.id, optA, "voter-1");
    store.vote(poll.id, optB, "voter-2");
    store.vote(poll.id, optB, "voter-1");

    const updated = store.getPoll(poll.id)!;
    expect(updated.options[0].votes).toBe(0);
    expect(updated.options[1].votes).toBe(2);
    expect(updated.voters.size).toBe(2);
  });

  it("resetPollVotes clears voters map", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    store.vote(poll.id, poll.options[0].id, "voter-1");

    const reset = store.resetPollVotes(poll.id)!;
    expect(reset.options[0].votes).toBe(0);
    expect(reset.voters.size).toBe(0);
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
