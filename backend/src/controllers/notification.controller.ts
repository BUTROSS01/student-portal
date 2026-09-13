import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";

/** GET /api/notifications/mine */
export async function listMyNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.sub },
      orderBy: { sentAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({ where: { userId: req.user!.sub, readAt: null } });
    return res.status(200).json({ notifications, unreadCount });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/notifications/:id/read */
export async function markNotificationRead(req: Request, res: Response, next: NextFunction) {
  try {
    const notification = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!notification || notification.userId !== req.user!.sub) throw ApiError.notFound("Notification not found");

    const updated = await prisma.notification.update({ where: { id: notification.id }, data: { readAt: new Date() } });
    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
}
