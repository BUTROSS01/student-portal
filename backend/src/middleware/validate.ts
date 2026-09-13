import { NextFunction, Request, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/apiError";

/**
 * Validates and sanitizes req.body against a Zod schema *before* it reaches
 * a controller. This is our primary defence against malformed input and
 * doubles as the first line of defence against injection-style payloads —
 * nothing reaches Prisma (parameterised queries) or a template without
 * first matching an explicit shape.
 */
export function validateBody(schema: AnyZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(ApiError.badRequest("Validation failed", err.flatten().fieldErrors));
      }
      next(err);
    }
  };
}
