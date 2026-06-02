import type { Request, Response, NextFunction } from "express";

export function requireLocal(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "This action is disabled on production" });
    return;
  }

  next();
}
