import { Router } from "express";
import * as feeController from "../controllers/fee.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { validateBody } from "../middleware/validate";
import { createFeeSchema, updateFeeSchema } from "../validators/finance.validator";

export const feeRouter = Router();
feeRouter.use(authenticate);

feeRouter.get("/mine", authorize("STUDENT"), feeController.getMyFees);
feeRouter.get("/student/:studentId", feeController.getStudentFees); // access checked inside (self/linked parent/staff)

feeRouter.get("/", authorize("FINANCE", "SUPER_ADMIN", "MANAGEMENT"), feeController.listFees);
feeRouter.post("/", authorize("FINANCE", "SUPER_ADMIN"), validateBody(createFeeSchema), feeController.createFee);
feeRouter.patch("/:id", authorize("FINANCE", "SUPER_ADMIN"), validateBody(updateFeeSchema), feeController.updateFee);
