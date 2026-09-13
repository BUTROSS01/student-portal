import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: err.message,
      details: err.details,
    });
  }

  // Never leak internal error detail (stack traces, DB errors, etc.) to the
  // client — log it server-side and return a generic message instead.
  console.error("Unhandled error:", err);
  return res.status(500).json({ error: "An unexpected error occurred. Please try again." });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
}
