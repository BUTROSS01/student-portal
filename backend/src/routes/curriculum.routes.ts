import { Router } from "express";
import * as curriculumController from "../controllers/curriculum.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { programmeSchema, subjectSchema } from "../validators/academic.validator";

export const programmeRouter = Router();
programmeRouter.use(authenticate);
programmeRouter.get("/", curriculumController.listProgrammes);
programmeRouter.post(
  "/",
  authorize("SUPER_ADMIN"),
  validateBody(programmeSchema),
  curriculumController.createProgramme
);
programmeRouter.patch("/:id", authorize("SUPER_ADMIN"), curriculumController.updateProgramme);
programmeRouter.delete("/:id", authorize("SUPER_ADMIN"), curriculumController.deleteProgramme);

export const subjectRouter = Router();
subjectRouter.use(authenticate);
subjectRouter.get("/", curriculumController.listSubjects);
subjectRouter.post("/", authorize("SUPER_ADMIN"), validateBody(subjectSchema), curriculumController.createSubject);
subjectRouter.patch("/:id", authorize("SUPER_ADMIN"), curriculumController.updateSubject);
subjectRouter.delete("/:id", authorize("SUPER_ADMIN"), curriculumController.deleteSubject);
