import { Router } from "express";
import * as reportController from "../controllers/report.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

export const reportRouter = Router();
reportRouter.use(authenticate);

reportRouter.get(
  "/student-register",
  authorize("SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT"),
  reportController.studentRegisterReport
);
reportRouter.get(
  "/fee-collection",
  authorize("FINANCE", "SUPER_ADMIN", "MANAGEMENT"),
  reportController.feeCollectionReport
);
reportRouter.get(
  "/academic-performance",
  authorize("ACADEMIC_ADMIN", "SUPER_ADMIN", "MANAGEMENT"),
  reportController.academicPerformanceReport
);
reportRouter.get(
  "/attendance",
  authorize("ACADEMIC_ADMIN", "SUPER_ADMIN", "MANAGEMENT"),
  reportController.attendanceReport
);
