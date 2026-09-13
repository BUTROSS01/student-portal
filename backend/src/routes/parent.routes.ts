import { Router } from "express";
import * as parentController from "../controllers/parent.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

export const parentRouter = Router();

parentRouter.use(authenticate, authorize("PARENT"));

parentRouter.get("/me/students", parentController.getMyLinkedStudents);
