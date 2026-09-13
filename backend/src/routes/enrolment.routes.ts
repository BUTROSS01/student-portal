import { Router } from "express";
import * as enrolmentController from "../controllers/enrolment.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { enrolStudentSchema, updateEnrolmentSchema } from "../validators/academic.validator";

export const enrolmentRouter = Router();
enrolmentRouter.use(authenticate);

enrolmentRouter.get("/mine", authorize("STUDENT"), enrolmentController.listMyEnrolments);

enrolmentRouter.get(
  "/",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT"),
  enrolmentController.listEnrolments
);
enrolmentRouter.post(
  "/",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN"),
  validateBody(enrolStudentSchema),
  enrolmentController.enrolStudent
);
enrolmentRouter.patch(
  "/:id",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN"),
  validateBody(updateEnrolmentSchema),
  enrolmentController.updateEnrolment
);
