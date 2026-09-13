import { Router } from "express";
import * as documentController from "../controllers/document.controller";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { uploadSingleFile } from "../middleware/upload";

export const documentRouter = Router();
documentRouter.use(authenticate);

documentRouter.get("/", documentController.listDocuments);
documentRouter.post("/", uploadSingleFile, documentController.uploadDocument);
documentRouter.get("/:id/download", documentController.downloadDocument);
documentRouter.patch("/:id/archive", authorize("SUPER_ADMIN"), documentController.archiveDocument);
