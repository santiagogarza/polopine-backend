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

  it("createPoll produces options with no authorId (system-owned)", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    for (const o of poll.options) {
      expect(o.authorId).toBeUndefined();
    }
  });

  it("addOption returns poll_not_found for missing poll", () => {
    const result = store.addOption("missing-poll", "new option", "voter-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("poll_not_found");
    }
  });

  it("addOption attaches authorId and trims text", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    const result = store.addOption(poll.id, "  Tacos  ", "voter-author");

    expect(result.ok).toBe(true);
    if (result.ok) {
      const added = result.poll.options[result.poll.options.length - 1];
      expect(added.text).toBe("Tacos");
      expect(added.authorId).toBe("voter-author");
      expect(added.votes).toBe(0);
    }
  });

  it("addOption rejects case-insensitive duplicates within the same poll", () => {
    const poll = store.createPoll("Q?", ["Tacos", "Pizza"]);

    const result = store.addOption(poll.id, "  tacos ", "voter-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("duplicate");
    }
  });

  it("addOption rejects past the per-poll cap", () => {
    const poll = store.createPoll("Q?", ["1", "2"]);
    for (let i = 3; i <= 12; i++) {
      expect(store.addOption(poll.id, `opt-${i}`, "voter-1").ok).toBe(true);
    }

    const overflow = store.addOption(poll.id, "opt-13", "voter-1");
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) {
      expect(overflow.error).toBe("too_many_options");
    }
  });

  it("deleteOption: author can remove their own zero-vote option", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const added = store.addOption(poll.id, "C", "voter-author");
    expect(added.ok).toBe(true);
    const optionId = added.ok ? added.poll.options.at(-1)!.id : "";

    const result = store.deleteOption(poll.id, optionId, {
      voterId: "voter-author",
      isAdmin: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.poll.options.map((o) => o.text)).toEqual(["A", "B"]);
    }
  });

  it("deleteOption: non-author voter cannot remove someone else's option", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);
    const added = store.addOption(poll.id, "C", "voter-alice");
    const optionId = added.ok ? added.poll.options.at(-1)!.id : "";

    const result = store.deleteOption(poll.id, optionId, {
      voterId: "voter-bob",
      isAdmin: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
    }
  });

  it("deleteOption: voter cannot remove seeded / authorless options", () => {
    const poll = store.createPoll("Q?", ["A", "B", "C"]);
    const seededOptionId = poll.options[0].id;

    const result = store.deleteOption(poll.id, seededOptionId, {
      voterId: "voter-1",
      isAdmin: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("forbidden");
    }
  });

  it("deleteOption: admin can remove any option that has no votes", () => {
    const poll = store.createPoll("Q?", ["A", "B", "C"]);
    const seededOptionId = poll.options[0].id;

    const result = store.deleteOption(poll.id, seededOptionId, {
      isAdmin: true,
    });
    expect(result.ok).toBe(true);
  });

  it("deleteOption: refuses options that have any votes (even for admin)", () => {
    const poll = store.createPoll("Q?", ["A", "B", "C"]);
    const optionWithVotes = poll.options[0];
    store.vote(poll.id, optionWithVotes.id);

    const result = store.deleteOption(poll.id, optionWithVotes.id, {
      isAdmin: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("has_votes");
    }
  });

  it("deleteOption: refuses to drop poll below 2 options", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    const result = store.deleteOption(poll.id, poll.options[0].id, {
      isAdmin: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("would_leave_too_few_options");
    }
  });

  it("deleteOption: returns option_not_found when the option id is unknown", () => {
    const poll = store.createPoll("Q?", ["A", "B"]);

    const result = store.deleteOption(poll.id, "missing-option", {
      isAdmin: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("option_not_found");
    }
  });

  it("deleteOption: returns poll_not_found for missing poll", () => {
    const result = store.deleteOption("missing-poll", "missing-option", {
      isAdmin: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("poll_not_found");
    }
  });
});
