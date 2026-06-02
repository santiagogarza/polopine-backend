import cors from "cors";
import express, { type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { requireAdmin } from "./middleware/requireAdmin.js";
import * as store from "./store.js";
import type { PollResults } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

export const app = express();

app.use(cors());
app.use(express.json());

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", version: packageJson.version });
});

app.post("/polls", (req: Request, res: Response) => {
  const { question, options } = req.body as {
    question?: unknown;
    options?: unknown;
  };

  if (!isNonEmptyString(question)) {
    res.status(400).json({ error: "question must be a non-empty string" });
    return;
  }

  if (!Array.isArray(options)) {
    res.status(400).json({ error: "options must be an array of strings" });
    return;
  }

  const trimmedOptions = options.map((o) =>
    typeof o === "string" ? o.trim() : "",
  );

  if (trimmedOptions.length < 2) {
    res.status(400).json({ error: "options must contain at least 2 items" });
    return;
  }

  if (trimmedOptions.some((o) => o.length === 0)) {
    res
      .status(400)
      .json({ error: "each option must be a non-empty string" });
    return;
  }

  const poll = store.createPoll(question.trim(), trimmedOptions);
  res.status(201).json(poll);
});

app.get("/polls", (_req: Request, res: Response) => {
  res.json(store.listPolls());
});

app.get("/polls/:id", (req: Request, res: Response) => {
  const poll = store.getPoll(req.params.id);
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  res.json(poll);
});

app.post("/polls/:id/vote", (req: Request, res: Response) => {
  const { optionId } = req.body as { optionId?: unknown };

  if (!isNonEmptyString(optionId)) {
    res.status(400).json({ error: "optionId must be a non-empty string" });
    return;
  }

  const poll = store.getPoll(req.params.id);
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  const hasOption = poll.options.some((o) => o.id === optionId);
  if (!hasOption) {
    res.status(400).json({ error: "optionId does not belong to this poll" });
    return;
  }

  const updated = store.vote(req.params.id, optionId);
  res.json(updated);
});

app.get("/polls/:id/results", (req: Request, res: Response) => {
  const poll = store.getPoll(req.params.id);
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const sortedOptions = [...poll.options].sort((a, b) => b.votes - a.votes);
  const results: PollResults = {
    question: poll.question,
    options: sortedOptions,
    totalVotes,
  };
  res.json(results);
});

app.delete("/polls/:id", requireAdmin, (req: Request, res: Response) => {
  const deleted = store.deletePoll(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  res.status(204).send();
});
