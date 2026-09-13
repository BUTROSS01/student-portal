import { Router } from "express";
import * as attendanceController from "../controllers/attendance.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { recordBulkAttendanceSchema } from "../validators/attendance.validator";

export const attendanceRouter = Router();
attendanceRouter.use(authenticate);

attendanceRouter.get("/mine", authorize("STUDENT"), attendanceController.getMyAttendance);
attendanceRouter.get("/student/:studentId", attendanceController.getStudentAttendance); // access checked inside

attendanceRouter.get(
  "/",
  authorize("LECTURER", "ACADEMIC_ADMIN", "SUPER_ADMIN", "MANAGEMENT"),
  attendanceController.listClassAttendance
);
attendanceRouter.post(
  "/",
  authorize("LECTURER"),
  validateBody(recordBulkAttendanceSchema),
  attendanceController.recordAttendance
);
