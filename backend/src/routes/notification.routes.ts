import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";
import { authenticate } from "../middleware/authenticate";

export const notificationRouter = Router();
notificationRouter.use(authenticate);

notificationRouter.get("/mine", notificationController.listMyNotifications);
notificationRouter.patch("/:id/read", notificationController.markNotificationRead);
