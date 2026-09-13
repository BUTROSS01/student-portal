import { Request, Response, NextFunction } from "express";
import fs from "fs";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { saveFile, resolveFilePath } from "../utils/storage.util";

/**
 * Resolves which studentId a request is allowed to act on/view for the
 * Documents module, and throws if the caller has no legitimate claim to
 * it. Mirrors the access rule already established in student.controller.ts
 * (self / linked parent / any staff role) so a student's documents are
 * exactly as protected as their profile.
 */
async function resolveAllowedStudentId(req: Request, requestedStudentId?: string): Promise<string | null | undefined> {
  const role = req.user!.role;

  if (role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
    if (!student) throw ApiError.notFound("Student profile not found");
    return student.id;
  }

  if (role === "PARENT") {
    if (!requestedStudentId) throw ApiError.badRequest("studentId is required");
    const link = await prisma.studentParentLink.findFirst({
      where: { studentId: requestedStudentId, parent: { userId: req.user!.sub } },
    });
    if (!link) throw ApiError.forbidden("This student is not linked to your account");
    return requestedStudentId;
  }

  // Staff roles: whatever was asked for (undefined = no filter / general document).
  return requestedStudentId;
}

/** POST /api/documents — multipart upload (field name "file"), plus "type" and optional "studentId" form fields. */
export async function uploadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw ApiError.badRequest("No file was uploaded (expected a 'file' field)");
    const { type } = req.body as { type?: string };
    if (!type) throw ApiError.badRequest("A document 'type' is required, e.g. PROOF_OF_PAYMENT, ADMISSION_LETTER");

    const studentId = await resolveAllowedStudentId(req, req.body.studentId);

    const storageKey = saveFile(req.file.buffer, req.file.originalname);

    const document = await prisma.document.create({
      data: {
        type,
        fileName: req.file.originalname,
        storageKey,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        studentId: studentId ?? undefined,
        uploadedById: req.user!.sub,
      },
      select: { id: true, type: true, fileName: true, mimeType: true, sizeBytes: true, status: true, uploadedAt: true },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "DOCUMENT_UPLOADED",
      entityType: "Document",
      entityId: document.id,
      metadata: { type, studentId },
      req,
    });

    return res.status(201).json(document);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/documents?studentId=&type= — list, access-scoped the same way as downloads. */
export async function listDocuments(req: Request, res: Response, next: NextFunction) {
  try {
    const { type } = req.query as { studentId?: string; type?: string };
    const studentId = await resolveAllowedStudentId(req, req.query.studentId as string | undefined);

    const documents = await prisma.document.findMany({
      where: {
        status: { not: "ARCHIVED" },
        ...(studentId !== undefined ? { studentId: studentId ?? null } : {}),
        ...(type ? { type } : {}),
      },
      select: { id: true, type: true, fileName: true, mimeType: true, sizeBytes: true, version: true, status: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    });

    return res.status(200).json({ documents });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/documents/:id/download */
export async function downloadDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw ApiError.notFound("Document not found");

    if (document.studentId) {
      const allowedId = await resolveAllowedStudentId(req, document.studentId);
      if (allowedId !== document.studentId) throw ApiError.forbidden();
    } else if (!["SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT", "FINANCE", "LECTURER"].includes(req.user!.role)) {
      throw ApiError.forbidden();
    }

    const filePath = resolveFilePath(document.storageKey);
    if (!fs.existsSync(filePath)) throw ApiError.notFound("The file for this document could not be found in storage");

    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${document.fileName}"`);
    return fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/documents/:id/archive — Super Admin only. Documents are archived, never hard-deleted. */
export async function archiveDocument(req: Request, res: Response, next: NextFunction) {
  try {
    const document = await prisma.document.update({ where: { id: req.params.id }, data: { status: "ARCHIVED" } });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "DOCUMENT_ARCHIVED",
      entityType: "Document",
      entityId: document.id,
      req,
    });
    return res.status(200).json({ message: "Document archived" });
  } catch (err) {
    return next(err);
  }
}
