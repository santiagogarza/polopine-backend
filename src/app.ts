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

function normalizeOptionText(value: string): string {
  return value.trim().toLocaleLowerCase();
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

    if (typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text must be a non-empty string" });
      return;
    }

    const trimmedText = text.trim();
    if (trimmedText.length > 80) {
      res.status(400).json({ error: "text must be 80 characters or fewer" });
      return;
    }

    const poll = store.getPoll(req.params.id);
    if (!poll) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }

    if (!poll.allowVoterOptions) {
      res.status(403).json({ error: "Voter-added options are disabled" });
      return;
    }

    const normalizedText = normalizeOptionText(trimmedText);
    const duplicate = poll.options.some(
      (option) => normalizeOptionText(option.text) === normalizedText,
    );
    if (duplicate) {
      res.status(409).json({ error: "Option already exists" });
      return;
    }

    const updated = store.addOption(
      req.params.id,
      trimmedText,
      res.locals.voterId as string,
    );
    res.status(201).json(updated);
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
    allowVoterOptions: poll.allowVoterOptions,
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

app.patch("/polls/:id", requireAdmin, (req: Request, res: Response) => {
  const { allowVoterOptions } = req.body as { allowVoterOptions?: unknown };

  if (typeof allowVoterOptions !== "boolean") {
    res.status(400).json({ error: "allowVoterOptions must be a boolean" });
    return;
  }

  const poll = store.setAllowVoterOptions(
    req.params.id,
    allowVoterOptions,
  );
  if (!poll) {
    res.status(404).json({ error: "Poll not found" });
    return;
  }

  res.json(poll);
});

app.delete(
  "/polls/:id/options/:optionId",
  requireAdmin,
  (req: Request, res: Response) => {
    const poll = store.getPoll(req.params.id);
    if (!poll) {
      res.status(404).json({ error: "Poll not found" });
      return;
    }

    const hasOption = poll.options.some(
      (option) => option.id === req.params.optionId,
    );
    if (!hasOption) {
      res.status(404).json({ error: "Option not found" });
      return;
    }

    const updated = store.deleteOption(req.params.id, req.params.optionId);
    res.json(updated);
  },
);

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
