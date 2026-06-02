import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import * as store from "../src/store.js";

const ADMIN_KEY = "test-admin-key";
const VOTER_ID = "voter-test-0001";

describe("polls API", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    store.clearPolls();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
    delete process.env.NODE_ENV;
  });

  it("creates a poll with zeroed votes", async () => {
    const res = await request(app)
      .post("/polls")
      .send({
        question: "Favorite color?",
        options: ["Red", "Blue"],
      })
      .expect(201);

    expect(res.body.question).toBe("Favorite color?");
    expect(res.body.options).toHaveLength(2);
    expect(res.body.options[0].votes).toBe(0);
    expect(res.body.options[1].votes).toBe(0);
    expect(res.body.options[0].authorVoterId).toBeNull();
    expect(res.body.options[1].authorVoterId).toBeNull();
    expect(res.body.allowVoterOptions).toBe(true);
    expect(res.body.id).toBeTruthy();
    expect(res.body.createdAt).toBeTruthy();
  });

  it("increments votes when casting a vote", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Pick one",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[0].id as string;

    const voteRes = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId })
      .expect(200);

    expect(voteRes.body.options[0].votes).toBe(1);
    expect(voteRes.body.options[1].votes).toBe(0);
  });

  it("adds a voter-authored option to an existing poll", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Dessert?",
        options: ["Cake", "Pie"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const addRes = await request(app)
      .post(`/polls/${pollId}/options`)
      .set("x-voter-id", VOTER_ID)
      .send({ text: " Ice cream " })
      .expect(201);

    expect(addRes.body.options).toHaveLength(3);
    expect(addRes.body.options[2]).toMatchObject({
      text: "Ice cream",
      votes: 0,
      authorVoterId: VOTER_ID,
    });
    expect(addRes.body.options[2].id).toBeTruthy();
  });

  it("POST /polls/:id/options returns 400 when x-voter-id header is missing", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Need author?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/options`)
      .send({ text: "C" })
      .expect(400);

    expect(res.body.error).toBe("x-voter-id header required");
  });

  it("POST /polls/:id/options returns 400 when text exceeds 80 characters", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Too long?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/options`)
      .set("x-voter-id", VOTER_ID)
      .send({ text: "x".repeat(81) })
      .expect(400);

    expect(res.body.error).toBe("text must be 80 characters or fewer");
  });

  it("POST /polls/:id/options returns 409 for case-insensitive duplicates", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Duplicate?",
        options: ["Pizza", "Salad"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/options`)
      .set("x-voter-id", VOTER_ID)
      .send({ text: "  pizza " })
      .expect(409);

    expect(res.body.error).toBe("Option already exists");
  });

  it("POST /polls/:id/options returns 403 when voter-added options are disabled", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Locked?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    await request(app)
      .patch(`/polls/${pollId}`)
      .set("x-admin-key", ADMIN_KEY)
      .send({ allowVoterOptions: false })
      .expect(200);

    const res = await request(app)
      .post(`/polls/${pollId}/options`)
      .set("x-voter-id", VOTER_ID)
      .send({ text: "C" })
      .expect(403);

    expect(res.body.error).toBe("Voter-added options are disabled");
  });

  it("toggles allowVoterOptions with admin key", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Toggle?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const patchRes = await request(app)
      .patch(`/polls/${pollId}`)
      .set("x-admin-key", ADMIN_KEY)
      .send({ allowVoterOptions: false })
      .expect(200);

    expect(patchRes.body.allowVoterOptions).toBe(false);
  });

  it("deletes an option with admin key and removes its votes from results", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Moderate?",
        options: ["Keep", "Remove"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[1].id as string;

    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId })
      .expect(200);

    const deleteRes = await request(app)
      .delete(`/polls/${pollId}/options/${optionId}`)
      .set("x-admin-key", ADMIN_KEY)
      .expect(200);

    expect(deleteRes.body.options).toHaveLength(1);
    expect(deleteRes.body.options[0].text).toBe("Keep");

    const resultsRes = await request(app)
      .get(`/polls/${pollId}/results`)
      .expect(200);

    expect(resultsRes.body.totalVotes).toBe(0);
    expect(resultsRes.body.options).toHaveLength(1);
  });

  it("DELETE /polls/:id/options/:optionId returns 404 for unknown option", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Unknown option?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const res = await request(app)
      .delete(`/polls/${pollId}/options/missing-option`)
      .set("x-admin-key", ADMIN_KEY)
      .expect(404);

    expect(res.body.error).toBe("Option not found");
  });

  it("returns results with correct totalVotes", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Lunch?",
        options: ["Pizza", "Salad", "Soup"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const opt0 = createRes.body.options[0].id as string;
    const opt1 = createRes.body.options[1].id as string;

    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: opt0 })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: opt0 })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: opt1 })
      .expect(200);

    const resultsRes = await request(app)
      .get(`/polls/${pollId}/results`)
      .expect(200);

    expect(resultsRes.body.question).toBe("Lunch?");
    expect(resultsRes.body.totalVotes).toBe(3);
    expect(resultsRes.body.options[0].votes).toBe(2);
    expect(resultsRes.body.options[1].votes).toBe(1);
    expect(resultsRes.body.options[2].votes).toBe(0);
  });

  it("returns 401 on DELETE without admin key", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Delete me?",
        options: ["Yes", "No"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    await request(app).delete(`/polls/${pollId}`).expect(401);
  });

  it("returns polls sorted by createdAt descending", async () => {
    store.seed();

    const res = await request(app).get("/polls").expect(200);

    expect(res.body).toHaveLength(3);
    expect(res.body[0].question).toBe("How much of a Cursor ninja are you?");
    expect(res.body[1].question).toBe("What's your top skill?");
    expect(res.body[2].question).toBe("What continent are you from?");

    for (let i = 0; i < res.body.length - 1; i++) {
      expect(res.body[i].createdAt >= res.body[i + 1].createdAt).toBe(true);
    }
  });

  it("returns results options sorted by votes descending", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Rank test?",
        options: ["Low", "Mid", "High"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const midId = createRes.body.options[1].id as string;
    const highId = createRes.body.options[2].id as string;

    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: highId })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: highId })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: midId })
      .expect(200);

    const resultsRes = await request(app)
      .get(`/polls/${pollId}/results`)
      .expect(200);

    expect(resultsRes.body.options.map((o: { text: string }) => o.text)).toEqual([
      "High",
      "Mid",
      "Low",
    ]);
    expect(resultsRes.body.options.map((o: { votes: number }) => o.votes)).toEqual([
      2, 1, 0,
    ]);
  });

  it("returns 401 on POST reset-votes without admin key", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Reset votes?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[0].id as string;

    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId })
      .expect(200);

    await request(app).post(`/polls/${pollId}/reset-votes`).expect(401);
  });

  it("zeros votes on POST reset-votes with valid admin key", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Reset votes?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[0].id as string;

    await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId })
      .expect(200);

    const resetRes = await request(app)
      .post(`/polls/${pollId}/reset-votes`)
      .set("x-admin-key", ADMIN_KEY)
      .expect(200);

    expect(resetRes.body.options.every((o: { votes: number }) => o.votes === 0)).toBe(
      true,
    );
  });

  it("returns 403 on POST admin reset-all when NODE_ENV is production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await request(app).post("/admin/reset-all").expect(403);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("reseeds store on POST admin reset-all when not production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      await request(app)
        .post("/polls")
        .send({
          question: "Extra poll",
          options: ["X", "Y"],
        })
        .expect(201);

      const res = await request(app).post("/admin/reset-all").expect(200);

      expect(res.body).toHaveLength(3);
      expect(res.body[0].question).toBe(
        "How much of a Cursor ninja are you?",
      );
      expect(
        res.body.every((p: { options: { votes: number }[] }) =>
          p.options.every((o) => o.votes === 0),
        ),
      ).toBe(true);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("GET /health returns ok status and package version", async () => {
    const res = await request(app).get("/health").expect(200);

    expect(res.body).toEqual({ status: "ok", version: "1.0.0" });
  });

  it.each([
    {
      name: "missing question",
      body: { options: ["A", "B"] },
      error: "question must be a non-empty string",
    },
    {
      name: "non-string question",
      body: { question: 42, options: ["A", "B"] },
      error: "question must be a non-empty string",
    },
    {
      name: "non-array options",
      body: { question: "Q?", options: "not-an-array" },
      error: "options must be an array of strings",
    },
    {
      name: "fewer than 2 options",
      body: { question: "Q?", options: ["Only one"] },
      error: "options must contain at least 2 items",
    },
    {
      name: "empty option string",
      body: { question: "Q?", options: ["A", "  "] },
      error: "each option must be a non-empty string",
    },
  ])("POST /polls returns 400 when $name", async ({ body, error }) => {
    const res = await request(app).post("/polls").send(body).expect(400);

    expect(res.body.error).toBe(error);
  });

  it("GET /polls/:id returns poll when it exists", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Exists?",
        options: ["Yes", "No"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const getRes = await request(app).get(`/polls/${pollId}`).expect(200);

    expect(getRes.body.id).toBe(pollId);
    expect(getRes.body.question).toBe("Exists?");
  });

  it("GET /polls/:id returns 404 for unknown id", async () => {
    const res = await request(app)
      .get("/polls/00000000-0000-0000-0000-000000000000")
      .expect(404);

    expect(res.body.error).toBe("Poll not found");
  });

  it("POST /polls/:id/vote returns 400 when optionId is missing", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Vote?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({})
      .expect(400);

    expect(res.body.error).toBe("optionId must be a non-empty string");
  });

  it("POST /polls/:id/vote returns 404 for unknown poll", async () => {
    const res = await request(app)
      .post("/polls/00000000-0000-0000-0000-000000000000/vote")
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: "opt-1" })
      .expect(404);

    expect(res.body.error).toBe("Poll not found");
  });

  it("POST /polls/:id/vote returns 400 when optionId does not belong to poll", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Vote?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", VOTER_ID)
      .send({ optionId: "00000000-0000-0000-0000-000000000000" })
      .expect(400);

    expect(res.body.error).toBe("optionId does not belong to this poll");
  });

  it("GET /polls/:id/results returns 404 for unknown poll", async () => {
    const res = await request(app)
      .get("/polls/00000000-0000-0000-0000-000000000000/results")
      .expect(404);

    expect(res.body.error).toBe("Poll not found");
  });

  it("GET /polls/:id/results returns zero-vote shape", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "No votes yet?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    const resultsRes = await request(app)
      .get(`/polls/${pollId}/results`)
      .expect(200);

    expect(resultsRes.body.question).toBe("No votes yet?");
    expect(resultsRes.body.totalVotes).toBe(0);
    expect(resultsRes.body.options).toHaveLength(2);
    expect(resultsRes.body.options.every((o: { votes: number }) => o.votes === 0)).toBe(
      true,
    );
  });

  it("DELETE /polls/:id returns 404 with valid admin key for unknown poll", async () => {
    const res = await request(app)
      .delete("/polls/00000000-0000-0000-0000-000000000000")
      .set("x-admin-key", ADMIN_KEY)
      .expect(404);

    expect(res.body.error).toBe("Poll not found");
  });

  it("POST /polls/:id/reset-votes returns 404 with valid admin key for unknown poll", async () => {
    const res = await request(app)
      .post("/polls/00000000-0000-0000-0000-000000000000/reset-votes")
      .set("x-admin-key", ADMIN_KEY)
      .expect(404);

    expect(res.body.error).toBe("Poll not found");
  });

  it("returns 401 on admin routes when ADMIN_API_KEY is unset", async () => {
    delete process.env.ADMIN_API_KEY;

    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Admin gate?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    await request(app)
      .delete(`/polls/${pollId}`)
      .set("x-admin-key", "any-key")
      .expect(401);

    await request(app)
      .post(`/polls/${pollId}/reset-votes`)
      .set("x-admin-key", "any-key")
      .expect(401);
  });

  it("returns 204 on DELETE with valid admin key", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Delete me?",
        options: ["Yes", "No"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;

    await request(app)
      .delete(`/polls/${pollId}`)
      .set("x-admin-key", ADMIN_KEY)
      .expect(204);

    await request(app).get(`/polls/${pollId}`).expect(404);
  });

  it("POST /polls/:id/vote returns 400 when x-voter-id header is missing", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Need voter id?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[0].id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/vote`)
      .send({ optionId })
      .expect(400);

    expect(res.body.error).toBe("x-voter-id header required");
  });

  it("POST /polls/:id/vote returns 400 when x-voter-id header is blank", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Blank voter id?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[0].id as string;

    const res = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", "   ")
      .send({ optionId })
      .expect(400);

    expect(res.body.error).toBe("x-voter-id header required");
  });

  it("POST /polls/:id/vote returns 400 when x-voter-id header exceeds length cap", async () => {
    const createRes = await request(app)
      .post("/polls")
      .send({
        question: "Too long voter id?",
        options: ["A", "B"],
      })
      .expect(201);

    const pollId = createRes.body.id as string;
    const optionId = createRes.body.options[0].id as string;

    const tooLong = "v".repeat(129);
    const res = await request(app)
      .post(`/polls/${pollId}/vote`)
      .set("x-voter-id", tooLong)
      .send({ optionId })
      .expect(400);

    expect(res.body.error).toBe("x-voter-id header too long");
  });

  it("POST /admin/verify returns 204 with valid admin key", async () => {
    await request(app)
      .post("/admin/verify")
      .set("x-admin-key", ADMIN_KEY)
      .expect(204);
  });

  it("POST /admin/verify returns 401 with wrong admin key", async () => {
    const res = await request(app)
      .post("/admin/verify")
      .set("x-admin-key", "wrong-key")
      .expect(401);

    expect(res.body.error).toBe("Unauthorized");
  });

  it("POST /admin/verify returns 401 without admin key header", async () => {
    const res = await request(app).post("/admin/verify").expect(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("POST /admin/verify rate-limits repeated failures from the same client", async () => {
    // Use a unique forwarded IP so we don't share a bucket with the other
    // /admin/verify tests above (the rate limiter is per-process state).
    const clientIp = "203.0.113.7";

    for (let i = 0; i < 5; i++) {
      await request(app)
        .post("/admin/verify")
        .set("x-forwarded-for", clientIp)
        .set("x-admin-key", "wrong-key")
        .expect(401);
    }

    const limited = await request(app)
      .post("/admin/verify")
      .set("x-forwarded-for", clientIp)
      .set("x-admin-key", "wrong-key")
      .expect(429);

    expect(limited.body.error).toBe("Too many requests");
    expect(limited.headers["retry-after"]).toBeTruthy();

    // Once the bucket is full the limiter fails closed — even a valid key
    // is rejected until the window resets.
    await request(app)
      .post("/admin/verify")
      .set("x-forwarded-for", clientIp)
      .set("x-admin-key", ADMIN_KEY)
      .expect(429);
  });
});
