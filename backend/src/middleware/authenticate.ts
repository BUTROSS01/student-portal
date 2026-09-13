import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
import { verifyAccessToken } from "../utils/tokens.util";

/**
 * Reads the short-lived access token from the Authorization header
 * ("Bearer <token>"), verifies its signature/expiry, and attaches the
 * decoded payload to req.user for downstream handlers and the
 * authorize() middleware.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing or malformed Authorization header"));
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return next(ApiError.unauthorized("Access token is invalid or has expired"));
  }
}
