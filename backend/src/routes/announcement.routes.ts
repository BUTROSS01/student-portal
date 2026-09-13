import { Router } from "express";
import * as announcementController from "../controllers/announcement.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { createAnnouncementSchema } from "../validators/communication.validator";

export const announcementRouter = Router();
announcementRouter.use(authenticate);

announcementRouter.get("/", announcementController.listAnnouncements);
announcementRouter.post(
  "/",
  authorize("SUPER_ADMIN", "MANAGEMENT", "ACADEMIC_ADMIN", "LECTURER"),
  validateBody(createAnnouncementSchema),
  announcementController.createAnnouncement
);
