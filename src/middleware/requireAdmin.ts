import type { Request, Response, NextFunction } from "express";

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const adminKey = process.env.ADMIN_API_KEY;
  const provided = req.header("x-admin-key");

  if (!adminKey || provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
