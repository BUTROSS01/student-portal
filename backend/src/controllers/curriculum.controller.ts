import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { recordAuditLog } from "../utils/audit.util";
import { toApiError } from "../utils/prismaErrors";
import { ProgrammeInput, SubjectInput } from "../validators/academic.validator";

// --- Programmes ---

/** GET /api/programmes — any authenticated user; optionally filtered by department. */
export async function listProgrammes(req: Request, res: Response, next: NextFunction) {
  try {
    const { departmentId } = req.query as { departmentId?: string };
    const programmes = await prisma.programme.findMany({
      where: departmentId ? { departmentId } : undefined,
      include: { department: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ programmes });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/programmes — Super Admin only. */
export async function createProgramme(req: Request, res: Response, next: NextFunction) {
  try {
    const programme = await prisma.programme.create({ data: req.body as ProgrammeInput });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "PROGRAMME_CREATED",
      entityType: "Programme",
      entityId: programme.id,
      req,
    });
    return res.status(201).json(programme);
  } catch (err) {
    return next(toApiError(err, { entity: "programme" }));
  }
}

/** PATCH /api/programmes/:id — Super Admin only. */
export async function updateProgramme(req: Request, res: Response, next: NextFunction) {
  try {
    const programme = await prisma.programme.update({
      where: { id: req.params.id },
      data: req.body as Partial<ProgrammeInput>,
    });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "PROGRAMME_UPDATED",
      entityType: "Programme",
      entityId: programme.id,
      req,
    });
    return res.status(200).json(programme);
  } catch (err) {
    return next(toApiError(err, { entity: "programme" }));
  }
}

/** DELETE /api/programmes/:id — Super Admin only. */
export async function deleteProgramme(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.programme.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "PROGRAMME_DELETED",
      entityType: "Programme",
      entityId: req.params.id,
      req,
    });
    return res.status(204).send();
  } catch (err) {
    return next(toApiError(err, { entity: "programme" }));
  }
}

// --- Subjects ---

/** GET /api/subjects — any authenticated user; optionally filtered by programme. */
export async function listSubjects(req: Request, res: Response, next: NextFunction) {
  try {
    const { programmeId } = req.query as { programmeId?: string };
    const subjects = await prisma.subject.findMany({
      where: programmeId ? { programmeId } : undefined,
      include: { programme: { select: { id: true, name: true, code: true } } },
      orderBy: { name: "asc" },
    });
    return res.status(200).json({ subjects });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/subjects — Super Admin only. */
export async function createSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subject = await prisma.subject.create({ data: req.body as SubjectInput });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "SUBJECT_CREATED",
      entityType: "Subject",
      entityId: subject.id,
      req,
    });
    return res.status(201).json(subject);
  } catch (err) {
    return next(toApiError(err, { entity: "subject" }));
  }
}

/** PATCH /api/subjects/:id — Super Admin only. */
export async function updateSubject(req: Request, res: Response, next: NextFunction) {
  try {
    const subject = await prisma.subject.update({
      where: { id: req.params.id },
      data: req.body as Partial<SubjectInput>,
    });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "SUBJECT_UPDATED",
      entityType: "Subject",
      entityId: subject.id,
      req,
    });
    return res.status(200).json(subject);
  } catch (err) {
    return next(toApiError(err, { entity: "subject" }));
  }
}

/** DELETE /api/subjects/:id — Super Admin only. */
export async function deleteSubject(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.subject.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "SUBJECT_DELETED",
      entityType: "Subject",
      entityId: req.params.id,
      req,
    });
    return res.status(204).send();
  } catch (err) {
    return next(toApiError(err, { entity: "subject" }));
  }
}
