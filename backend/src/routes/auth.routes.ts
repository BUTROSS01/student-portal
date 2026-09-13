import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticate } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { loginRateLimiter, passwordResetRateLimiter } from "../middleware/rateLimiters";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  enable2faVerifySchema,
} from "../validators/auth.validator";

export const authRouter = Router();

authRouter.post("/login", loginRateLimiter, validateBody(loginSchema), authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authenticate, authController.logout);

authRouter.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validateBody(forgotPasswordSchema),
  authController.forgotPassword
);
authRouter.post("/reset-password", validateBody(resetPasswordSchema), authController.resetPassword);

authRouter.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  authController.changePassword
);

authRouter.post("/2fa/setup", authenticate, authController.setupTwoFactor);
authRouter.post(
  "/2fa/verify",
  authenticate,
  validateBody(enable2faVerifySchema),
  authController.verifyTwoFactor
);

authRouter.get("/me", authenticate, authController.me);
