import multer from "multer";
import { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
}).single("file");

/**
 * Single-file upload middleware for the Documents module. Uses memory
 * storage (not multer's disk storage) so storage.util.ts stays the one
 * place that decides where bytes actually end up — swapping to S3 later
 * touches that file only, not this middleware or any route that uses it.
 *
 * Wraps multer's callback-style error reporting into the same ApiError
 * shape as the rest of the API, so a too-large upload comes back as a
 * clean 400 instead of falling through to the generic 500 handler.
 */
export function uploadSingleFile(req: Request, res: Response, next: NextFunction) {
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return next(ApiError.badRequest(`File exceeds the ${env.MAX_UPLOAD_SIZE_MB}MB upload limit`));
    }
    return next(ApiError.badRequest("Could not process the uploaded file"));
  });
}
