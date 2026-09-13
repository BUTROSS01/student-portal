import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { hashPassword } from "../utils/password.util";
import { recordAuditLog } from "../utils/audit.util";
import { CreateUserInput, UpdateUserInput } from "../validators/user.validator";

/**
 * GET /api/staff — lightweight listing used for dropdowns (e.g. assigning a
 * lecturer to a Class). Super Admin and Academic Admin only; deliberately
 * not exposed to Lecturer/Finance/Management to avoid turning this into a
 * general staff directory beyond what each role actually needs.
 */
export async function listStaff(req: Request, res: Response, next: NextFunction) {
  try {
    const { role } = req.query as { role?: string };

    const staff = await prisma.staff.findMany({
      where: role ? { user: { role: { name: role as any } } } : undefined,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        jobTitle: true,
        department: { select: { id: true, name: true } },
        user: { select: { email: true, role: { select: { name: true } } } },
      },
      orderBy: { lastName: "asc" },
    });

    return res.status(200).json({ staff });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/users — paginated, filterable list. Super Admin only.
 * (College Management gets a read-only statistics view instead, built in
 * the Reporting module — it does not need row-level user records.)
 */
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const { role, status, search, page, pageSize } = req.query as unknown as {
      role?: string;
      status?: string;
      search?: string;
      page: number;
      pageSize: number;
    };

    const where = {
      ...(role ? { role: { name: role as any } } : {}),
      ...(status ? { status: status as any } : {}),
      ...(search
        ? { email: { contains: search, mode: "insensitive" as const } }
        : {}),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          role: { select: { name: true } },
          campus: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return res.status(200).json({ total, page, pageSize, users });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/users/:id */
export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        phone: true,
        status: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { name: true } },
        campus: { select: { id: true, name: true } },
      },
    });
    if (!user) throw ApiError.notFound("User not found");
    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/users — Super Admin creates an account for any role.
 * Generates a temporary password, forces a change on first login, and never
 * returns the temporary password in a way that ends up logged — it's
 * handed to the Communication module to deliver out-of-band (email/SMS).
 */
export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateUserInput;

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict("A user with this email already exists");

    const existingEmployeeNumber = await prisma.staff.findUnique({
      where: { employeeNumber: input.employeeNumber },
    });
    if (existingEmployeeNumber) throw ApiError.conflict("This employee number is already in use");

    const role = await prisma.role.findUnique({ where: { name: input.role } });
    if (!role) throw ApiError.badRequest("Unknown role");

    const temporaryPassword = crypto.randomBytes(9).toString("base64url"); // 12-char, URL-safe
    const passwordHash = await hashPassword(temporaryPassword);

    const { user, staff } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          passwordHash,
          roleId: role.id,
          campusId: input.campusId,
          status: "PENDING_VERIFICATION",
          mustChangePassword: true,
        },
      });

      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          firstName: input.firstName,
          lastName: input.lastName,
          employeeNumber: input.employeeNumber,
          departmentId: input.departmentId,
          jobTitle: input.jobTitle,
        },
      });

      return { user, staff };
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user.id,
      metadata: { role: input.role, employeeNumber: staff.employeeNumber },
      req,
    });

    // TODO(notifications-module): email temporaryPassword + activation link to input.email.
    return res.status(201).json({
      id: user.id,
      email: user.email,
      role: input.role,
      staffId: staff.id,
      temporaryPassword, // returned once, to the admin's screen, for handoff — not logged.
    });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/users/:id — Super Admin edits role/status/campus/phone. */
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const targetId = req.params.id;
    const input = req.body as UpdateUserInput;

    if (targetId === req.user!.sub && input.status && input.status !== "ACTIVE") {
      throw ApiError.badRequest("You cannot suspend or deactivate your own account");
    }

    const data: Record<string, unknown> = { ...input };
    if (input.role) {
      const role = await prisma.role.findUnique({ where: { name: input.role } });
      if (!role) throw ApiError.badRequest("Unknown role");
      data.roleId = role.id;
      delete data.role;
    }

    const user = await prisma.user.update({ where: { id: targetId }, data });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: user.id,
      metadata: input,
      req,
    });

    return res.status(200).json({ id: user.id, status: user.status });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/users/:id/deactivate — soft-disable rather than delete, to preserve audit/history integrity. */
export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const targetId = req.params.id;
    if (targetId === req.user!.sub) {
      throw ApiError.badRequest("You cannot deactivate your own account");
    }

    await prisma.user.update({ where: { id: targetId }, data: { status: "DEACTIVATED" } });
    await prisma.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "USER_DEACTIVATED",
      entityType: "User",
      entityId: targetId,
      req,
    });

    return res.status(200).json({ message: "User deactivated" });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/users/:id/reset-password — admin-triggered forced reset (e.g. lost device, suspected compromise). */
export async function adminResetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const targetId = req.params.id;
    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { id: targetId },
      data: { passwordHash, mustChangePassword: true },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: targetId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "USER_PASSWORD_RESET_BY_ADMIN",
      entityType: "User",
      entityId: targetId,
      req,
    });

    return res.status(200).json({ temporaryPassword });
  } catch (err) {
    return next(err);
  }
}
