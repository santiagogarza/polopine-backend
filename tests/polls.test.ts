import { afterEach, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import * as store from "../src/store.js";

const ADMIN_KEY = "test-admin-key";

describe("polls API", () => {
  beforeEach(() => {
    process.env.ADMIN_API_KEY = ADMIN_KEY;
    store.clearPolls();
  });

  afterEach(() => {
    delete process.env.ADMIN_API_KEY;
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
      .send({ optionId })
      .expect(200);

    expect(voteRes.body.options[0].votes).toBe(1);
    expect(voteRes.body.options[1].votes).toBe(0);
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
      .send({ optionId: opt0 })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
      .send({ optionId: opt0 })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
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
      .send({ optionId: highId })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
      .send({ optionId: highId })
      .expect(200);
    await request(app)
      .post(`/polls/${pollId}/vote`)
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
});
