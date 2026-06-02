import { beforeEach, describe, expect, it } from "vitest";
import * as store from "../src/store.js";

describe("store", () => {
  beforeEach(() => {
    store.clearPolls();
  });

  it("vote returns undefined for missing poll", () => {
    expect(store.vote("missing-poll", "missing-option", "voter-1")).toBeUndefined();
  });

  it("vote returns undefined for missing option on existing poll", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    expect(store.vote(poll.id, "missing-option", "voter-1")).toBeUndefined();
  });

  it("vote is idempotent when the same voter picks the same option twice", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;

    store.vote(poll.id, optionA, "voter-1");
    store.vote(poll.id, optionA, "voter-1");

    const after = store.getPoll(poll.id);
    expect(after?.options[0].votes).toBe(1);
    expect(after?.options[1].votes).toBe(0);
  });

  it("vote upserts when a voter switches from one option to another", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    store.vote(poll.id, optionA, "voter-1");
    store.vote(poll.id, optionB, "voter-1");

    const after = store.getPoll(poll.id);
    expect(after?.options[0].votes).toBe(0);
    expect(after?.options[1].votes).toBe(1);
  });

  it("vote keeps distinct voters independent when one switches", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    store.vote(poll.id, optionA, "voter-1");
    store.vote(poll.id, optionB, "voter-2");

    let after = store.getPoll(poll.id);
    expect(after?.options[0].votes).toBe(1);
    expect(after?.options[1].votes).toBe(1);

    // voter-1 switches; voter-2 should be untouched.
    store.vote(poll.id, optionB, "voter-1");

    after = store.getPoll(poll.id);
    expect(after?.options[0].votes).toBe(0);
    expect(after?.options[1].votes).toBe(2);
  });

  it("resetPollVotes clears the voter map so a prior voter can vote fresh", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const optionA = poll.options[0].id;
    const optionB = poll.options[1].id;

    store.vote(poll.id, optionA, "voter-1");
    store.resetPollVotes(poll.id);

    // Without map-clear this would be a same-option no-op and leave votes at 0.
    store.vote(poll.id, optionA, "voter-1");
    store.vote(poll.id, optionB, "voter-1");

    const after = store.getPoll(poll.id);
    expect(after?.options[0].votes).toBe(0);
    expect(after?.options[1].votes).toBe(1);
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
