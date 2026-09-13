import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

export const staffRouter = Router();

staffRouter.use(authenticate, authorize("SUPER_ADMIN", "ACADEMIC_ADMIN"));
staffRouter.get("/", userController.listStaff);
