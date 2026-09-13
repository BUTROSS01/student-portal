import { Router } from "express";
import * as messageController from "../controllers/message.controller";
import { authenticate } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { sendMessageSchema } from "../validators/communication.validator";

export const messageRouter = Router();
messageRouter.use(authenticate);

messageRouter.get("/inbox", messageController.listInbox);
messageRouter.get("/sent", messageController.listSent);
messageRouter.post("/", validateBody(sendMessageSchema), messageController.sendMessage);
messageRouter.patch("/:id/read", messageController.markMessageRead);
