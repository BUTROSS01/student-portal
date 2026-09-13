import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { submitPaymentSchema, rejectPaymentSchema } from "../validators/finance.validator";

export const paymentRouter = Router();
paymentRouter.use(authenticate);

paymentRouter.get("/mine", authorize("STUDENT"), paymentController.getMyPayments);
paymentRouter.post("/", authorize("STUDENT", "PARENT"), validateBody(submitPaymentSchema), paymentController.submitPayment);

paymentRouter.get("/", authorize("FINANCE", "SUPER_ADMIN", "MANAGEMENT"), paymentController.listPayments);
paymentRouter.post("/:id/verify", authorize("FINANCE", "SUPER_ADMIN"), paymentController.verifyPayment);
paymentRouter.post(
  "/:id/reject",
  authorize("FINANCE", "SUPER_ADMIN"),
  validateBody(rejectPaymentSchema),
  paymentController.rejectPayment
);
