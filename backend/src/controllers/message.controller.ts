import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { notifyUser } from "../utils/notify.util";
import { SendMessageInput } from "../validators/communication.validator";

/** POST /api/messages */
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as SendMessageInput;

    const recipient = await prisma.user.findUnique({ where: { id: input.recipientId } });
    if (!recipient) throw ApiError.notFound("Recipient not found");

    const message = await prisma.message.create({
      data: { senderId: req.user!.sub, recipientId: input.recipientId, subject: input.subject, body: input.body },
    });

    await notifyUser(input.recipientId, input.subject ?? "New message", input.body.slice(0, 140));

    return res.status(201).json(message);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/messages/inbox */
export async function listInbox(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await prisma.message.findMany({
      where: { recipientId: req.user!.sub },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    return res.status(200).json({ messages });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/messages/sent */
export async function listSent(req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await prisma.message.findMany({
      where: { senderId: req.user!.sub },
      orderBy: { sentAt: "desc" },
      take: 100,
    });
    return res.status(200).json({ messages });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/messages/:id/read */
export async function markMessageRead(req: Request, res: Response, next: NextFunction) {
  try {
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message || message.recipientId !== req.user!.sub) throw ApiError.notFound("Message not found");

    const updated = await prisma.message.update({ where: { id: message.id }, data: { readAt: new Date() } });
    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
}
