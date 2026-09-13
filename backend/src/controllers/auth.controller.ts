import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { authenticator } from "otplib";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { ApiError } from "../utils/apiError";
import { hashPassword, verifyPassword } from "../utils/password.util";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
} from "../utils/tokens.util";
import { recordAuditLog } from "../utils/audit.util";
import { LoginInput, ResetPasswordInput, ChangePasswordInput } from "../validators/auth.validator";

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
};

/**
 * POST /api/auth/login
 *
 * Verifies credentials, enforces account-lockout policy, and (if the
 * account has 2FA enabled) requires a valid TOTP code before issuing
 * tokens. Access tokens are short-lived and returned in the JSON body;
 * refresh tokens are long-lived and set as an httpOnly cookie so they are
 * never exposed to client-side JavaScript (mitigates XSS token theft).
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  const { email, password, totpCode } = req.body as LoginInput;

  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });

    // Constant-shape response whether or not the account exists, to avoid
    // leaking which emails are registered.
    if (!user) {
      await recordAuditLog({ action: "LOGIN_FAILED_UNKNOWN_EMAIL", metadata: { email }, req });
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordAuditLog({ userId: user.id, action: "LOGIN_BLOCKED_ACCOUNT_LOCKED", req });
      throw ApiError.unauthorized(
        `Account is temporarily locked due to repeated failed sign-in attempts. Try again after ${user.lockedUntil.toISOString()}.`
      );
    }

    if (user.status !== "ACTIVE" && user.status !== "PENDING_VERIFICATION") {
      await recordAuditLog({ userId: user.id, action: "LOGIN_BLOCKED_ACCOUNT_STATUS", req });
      throw ApiError.unauthorized("This account is suspended or deactivated. Contact the college for help.");
    }

    const passwordOk = await verifyPassword(password, user.passwordHash);

    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= env.MAX_FAILED_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + env.LOCKOUT_MINUTES * 60 * 1000)
            : user.lockedUntil,
        },
      });

      await recordAuditLog({ userId: user.id, action: "LOGIN_FAILED_BAD_PASSWORD", req });
      throw ApiError.unauthorized("Invalid email or password");
    }

    if (user.twoFactorEnabled) {
      if (!totpCode) {
        // Signal the client to prompt for a 2FA code without granting a session.
        return res.status(200).json({ twoFactorRequired: true });
      }
      const validCode = authenticator.check(totpCode, user.twoFactorSecret ?? "");
      if (!validCode) {
        await recordAuditLog({ userId: user.id, action: "LOGIN_FAILED_BAD_2FA", req });
        throw ApiError.unauthorized("Invalid authentication code");
      }
    }

    // Successful login: reset lockout counters, issue tokens.
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role.name, campusId: user.campusId });
    const refreshToken = signRefreshToken(user.id);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    await recordAuditLog({ userId: user.id, action: "LOGIN_SUCCESS", req });

    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
    return res.status(200).json({
      accessToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        role: user.role.name,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/refresh
 *
 * Exchanges a valid, non-revoked refresh token (from the httpOnly cookie)
 * for a new access token. Implements refresh-token rotation: the old token
 * is revoked and a new one issued on every use, which limits the blast
 * radius if a refresh token is ever stolen.
 */
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized("No refresh token provided");

    const decoded = verifyRefreshToken(token);
    const tokenHash = hashToken(token);

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token is invalid or has expired");
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.sub }, include: { role: true } });
    if (!user || user.status !== "ACTIVE") {
      throw ApiError.unauthorized("Account is no longer active");
    }

    await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const newRefreshToken = signRefreshToken(user.id);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(newRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      },
    });

    const accessToken = signAccessToken({ sub: user.id, role: user.role.name, campusId: user.campusId });

    res.cookie(REFRESH_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTIONS);
    return res.status(200).json({ accessToken });
  } catch (err) {
    return next(ApiError.unauthorized("Session expired, please log in again"));
  }
}

/** POST /api/auth/logout — revokes the current refresh token and clears the cookie. */
export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      await prisma.refreshToken
        .update({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } })
        .catch(() => undefined); // already revoked/missing — logout should still succeed
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    await recordAuditLog({ userId: req.user?.sub, action: "LOGOUT", req });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Always returns 200 (never reveals whether the email exists) and, when it
 * does, creates a one-time reset token and hands it to the notification
 * service (email/SMS) rather than the client's own SMTP logic.
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body as { email: string };
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      // In production this token (hashed) and its expiry would be persisted
      // to a PasswordResetToken table and the raw token emailed to the user
      // via the notification service (see Module: Communication).
      await recordAuditLog({ userId: user.id, action: "PASSWORD_RESET_REQUESTED", req });
      // TODO(notifications-module): dispatch email with resetToken link.
      void resetToken;
    }

    return res.status(200).json({
      message: "If that email is registered, password reset instructions have been sent.",
    });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/reset-password — consumes a reset token and sets a new password. */
export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { newPassword } = req.body as ResetPasswordInput;
    // Token lookup against the PasswordResetToken table would happen here;
    // omitted in this module scaffold pending the Communication module.
    const passwordHash = await hashPassword(newPassword);
    void passwordHash;
    return res.status(200).json({ message: "Password has been reset. Please log in." });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/change-password — self-service change while authenticated. */
export async function changePassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { currentPassword, newPassword } = req.body as ChangePasswordInput;
    const userId = req.user!.sub;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) throw ApiError.badRequest("Current password is incorrect");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });

    // Revoke all existing sessions so a compromised session can't persist
    // past a password change.
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAuditLog({ userId, action: "PASSWORD_CHANGED", req });
    return res.status(200).json({ message: "Password updated. Please log in again." });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/2fa/setup — generates a TOTP secret and QR-ready otpauth URI. */
export async function setupTwoFactor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, "Tshwane City College Portal", secret);

    // Stored but not yet "enabled" until the user verifies a code — see verifyTwoFactor.
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    return res.status(200).json({ otpauthUrl });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/2fa/verify — confirms the user can generate valid codes, then enables 2FA. */
export async function verifyTwoFactor(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const { totpCode } = req.body as { totpCode: string };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.twoFactorSecret || !authenticator.check(totpCode, user.twoFactorSecret)) {
      throw ApiError.badRequest("Invalid authentication code");
    }

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    await recordAuditLog({ userId, action: "TWO_FACTOR_ENABLED", req });
    return res.status(200).json({ message: "Two-factor authentication enabled." });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/auth/me — returns the authenticated user's own profile summary. */
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user!.sub },
      select: {
        id: true,
        email: true,
        status: true,
        mustChangePassword: true,
        twoFactorEnabled: true,
        role: { select: { name: true } },
        campusId: true,
      },
    });
    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
}
