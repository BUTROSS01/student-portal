import { Router } from "express";
import * as classController from "../controllers/class.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { classSchema, updateClassSchema } from "../validators/academic.validator";

export const classRouter = Router();
classRouter.use(authenticate);

// Placed before "/" so it isn't shadowed, and scoped to Lecturer only.
classRouter.get("/mine", authorize("LECTURER"), classController.listMyClasses);

classRouter.get(
  "/:id/students",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN", "LECTURER"),
  classController.listClassStudents
);

classRouter.get(
  "/",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT"),
  classController.listClasses
);
classRouter.post(
  "/",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN"),
  validateBody(classSchema),
  classController.createClass
);
classRouter.patch(
  "/:id",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN"),
  validateBody(updateClassSchema),
  classController.updateClass
);
classRouter.delete("/:id", authorize("SUPER_ADMIN", "ACADEMIC_ADMIN"), classController.deleteClass);
