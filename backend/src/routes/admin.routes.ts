import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";

export const auditLogRouter = Router();
auditLogRouter.use(authenticate, authorize("SUPER_ADMIN"));
auditLogRouter.get("/", adminController.listAuditLogs);

export const adminSettingsRouter = Router();
adminSettingsRouter.use(authenticate, authorize("SUPER_ADMIN"));
adminSettingsRouter.get("/settings", adminController.getSystemSettings);
