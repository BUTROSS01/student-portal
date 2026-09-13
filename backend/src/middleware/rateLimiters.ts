import rateLimit from "express-rate-limit";

/**
 * Applies to /auth/login. Deliberately tighter than general API limits:
 * login is the highest-value target for automated abuse. Per-account
 * lockout (see failedLoginAttempts on the User model) is a second,
 * independent layer on top of this IP-based limit.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts from this network. Please try again later." },
});

/** Applies to password-reset requests, to prevent email/SMS bombing. */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password reset requests. Please try again later." },
});

/** General-purpose limiter applied to the whole API. */
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
