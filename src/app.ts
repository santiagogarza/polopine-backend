import cors from "cors";
import express, { type Request, type Response } from "express";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { rateLimit } from "./middleware/rateLimit.js";
import { requireAdmin } from "./middleware/requireAdmin.js";
import { requireLocal } from "./middleware/requireLocal.js";
import { requireVoterId } from "./middleware/requireVoterId.js";
import * as store from "./store.js";
import type { PollResults } from "./types.js";
import { MAX_OPTION_TEXT_LENGTH, MAX_OPTIONS_PER_POLL } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
) as { version: string };

export const app = express();

// Render terminates TLS at a single proxy hop; trust it so `req.ip` reflects
// the real client and the rate limiter buckets per-client instead of per-edge.
app.set("trust proxy", 1);

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

app.post("/polls/:id/vote", requireVoterId, (req: Request, res: Response) => {
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

app.post(
  "/polls/:id/options",
  requireVoterId,
  (req: Request, res: Response) => {
    const { text } = req.body as { text?: unknown };
    const voterId = res.locals.voterId as string;

    if (!isNonEmptyString(text)) {
      res.status(400).json({ error: "text must be a non-empty string" });
      return;
    }

    const trimmed = text.trim();
    if (trimmed.length > MAX_OPTION_TEXT_LENGTH) {
      res.status(400).json({
        error: `text must be at most ${MAX_OPTION_TEXT_LENGTH} characters`,
      });
      return;
    }

    const result = store.addOption(req.params.id, trimmed, voterId);
    if (!result.ok) {
      switch (result.error) {
        case "poll_not_found":
          res.status(404).json({ error: "Poll not found" });
          return;
        case "duplicate":
          res.status(409).json({
            error: "An option with this text already exists in this poll",
          });
          return;
        case "too_many_options":
          res.status(422).json({
            error: `Polls are limited to ${MAX_OPTIONS_PER_POLL} options`,
          });
          return;
      }
    }
    res.status(200).json(result.poll);
  },
);

/**
 * Deletes an option. Authorized either by `x-voter-id` (must match the
 * option's `authorId`) or `x-admin-key`. Returns the updated poll. Options
 * that have already received votes are immutable to keep recorded counts
 * honest — even for admins, who can fall back to `POST /polls/:id/reset-votes`
 * + `DELETE` to start over.
 */
app.delete(
  "/polls/:id/options/:optionId",
  (req: Request, res: Response) => {
    const providedAdmin = req.header("x-admin-key");
    const adminKey = process.env.ADMIN_API_KEY;
    const isAdmin =
      typeof providedAdmin === "string" &&
      typeof adminKey === "string" &&
      providedAdmin === adminKey;

    const rawVoter = req.header("x-voter-id");
    const voterId =
      typeof rawVoter === "string" && rawVoter.trim().length > 0
        ? rawVoter.trim()
        : undefined;

    if (!isAdmin && !voterId) {
      res
        .status(401)
        .json({ error: "x-voter-id or valid x-admin-key required" });
      return;
    }

    if (voterId !== undefined && voterId.length > 128) {
      res.status(400).json({ error: "x-voter-id header too long" });
      return;
    }

    const result = store.deleteOption(req.params.id, req.params.optionId, {
      voterId,
      isAdmin,
    });

    if (!result.ok) {
      switch (result.error) {
        case "poll_not_found":
          res.status(404).json({ error: "Poll not found" });
          return;
        case "option_not_found":
          res.status(404).json({ error: "Option not found" });
          return;
        case "forbidden":
          res.status(403).json({
            error: "Only the option's author or an admin can delete it",
          });
          return;
        case "has_votes":
          res.status(409).json({
            error: "Cannot delete an option that already has votes",
          });
          return;
        case "would_leave_too_few_options":
          res.status(409).json({
            error: "A poll must keep at least 2 options",
          });
          return;
      }
    }
    res.status(200).json(result.poll);
  },
);

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

const adminVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
});

app.post(
  "/admin/verify",
  adminVerifyLimiter,
  requireAdmin,
  (_req: Request, res: Response) => {
    res.status(204).send();
  },
);

app.delete("/polls/:id", requireAdmin, (req: Request, res: Response) => {
  const deleted = store.deletePoll(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }
  res.status(204).send();
});

app.post(
  "/polls/:id/reset-votes",
  requireAdmin,
  (req: Request, res: Response) => {
    const poll = store.resetPollVotes(req.params.id);
    if (!poll) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }
    res.json(poll);
  },
);

app.post("/admin/reset-all", requireLocal, (_req: Request, res: Response) => {
  store.clearPolls();
  store.seed();
  res.json(store.listPolls());
});
