import { Router } from "express";
import * as resultController from "../controllers/result.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import {
  enterResultSchema,
  updateResultSchema,
  rejectResultSchema,
  publishResultsSchema,
} from "../validators/result.validator";

export const resultRouter = Router();
resultRouter.use(authenticate);

// Specific paths first so they aren't shadowed by "/:id".
resultRouter.get("/mine", authorize("STUDENT"), resultController.getMyResults);
resultRouter.get(
  "/transcript/:studentId",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT", "STUDENT", "PARENT"),
  resultController.getTranscript
);
resultRouter.post(
  "/publish",
  authorize("ACADEMIC_ADMIN", "SUPER_ADMIN"),
  validateBody(publishResultsSchema),
  resultController.publishResults
);

resultRouter.get(
  "/",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT", "LECTURER"),
  resultController.listResults
);
resultRouter.post("/", authorize("LECTURER"), validateBody(enterResultSchema), resultController.enterResult);

resultRouter.patch("/:id", authorize("LECTURER"), validateBody(updateResultSchema), resultController.updateResult);
resultRouter.post("/:id/submit", authorize("LECTURER"), resultController.submitResult);
resultRouter.post("/:id/approve", authorize("ACADEMIC_ADMIN", "SUPER_ADMIN"), resultController.approveResult);
resultRouter.post(
  "/:id/reject",
  authorize("ACADEMIC_ADMIN", "SUPER_ADMIN"),
  validateBody(rejectResultSchema),
  resultController.rejectResult
);
