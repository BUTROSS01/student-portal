import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { env } from "../config/env";

/** GET /api/audit-logs — Super Admin only. Paginated, filterable. */
export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId, action, entityType, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));

    const where = {
      ...(userId ? { userId } : {}),
      ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
      ...(entityType ? { entityType } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ipAddress: true,
          metadata: true,
          createdAt: true,
          user: { select: { email: true, role: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
      }),
    ]);

    return res.status(200).json({ total, page: pageNum, pageSize: pageSizeNum, logs });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/admin/settings — Super Admin only. Read-only: this scaffold's
 * settings are env-variable-driven (see .env.example), not stored in the
 * database, so there is nothing to edit here yet. This endpoint exists so
 * the Super Admin can at least see the effective configuration without
 * SSH access to the server. A future enhancement would move these into a
 * `SystemSetting` table so they're editable from the UI without a
 * redeploy — deliberately not built speculatively here.
 */
export async function getSystemSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    return res.status(200).json({
      passwordMinLength: env.PASSWORD_MIN_LENGTH,
      maxFailedLoginAttempts: env.MAX_FAILED_LOGIN_ATTEMPTS,
      lockoutMinutes: env.LOCKOUT_MINUTES,
      attendanceAlertThreshold: env.ATTENDANCE_ALERT_THRESHOLD,
      maxUploadSizeMb: env.MAX_UPLOAD_SIZE_MB,
    });
  } catch (err) {
    return next(err);
  }
}
