import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { toApiError } from "../utils/prismaErrors";
import { EnrolStudentInput } from "../validators/academic.validator";

const ENROLMENT_SELECT = {
  id: true,
  academicYear: true,
  semester: true,
  status: true,
  subject: { select: { id: true, name: true, code: true, credits: true } },
  createdAt: true,
};

/**
 * POST /api/enrolments — Academic Admin, Super Admin.
 * Allocates a student to a subject for a given academic year and semester.
 * The (studentId, subjectId, academicYear, semester) combination is unique
 * at the database level, so re-submitting the same allocation is rejected
 * with a clear conflict rather than a silent duplicate.
 */
export async function enrolStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as EnrolStudentInput;

    const [student, subject] = await Promise.all([
      prisma.student.findUnique({ where: { id: input.studentId } }),
      prisma.subject.findUnique({ where: { id: input.subjectId } }),
    ]);
    if (!student) throw ApiError.notFound("Student not found");
    if (!subject) throw ApiError.notFound("Subject not found");

    const enrolment = await prisma.enrolment.create({
      data: input,
      select: { ...ENROLMENT_SELECT, studentId: true },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "STUDENT_ENROLLED",
      entityType: "Enrolment",
      entityId: enrolment.id,
      metadata: { studentId: input.studentId, subjectId: input.subjectId },
      req,
    });

    return res.status(201).json(enrolment);
  } catch (err) {
    return next(toApiError(err, { entity: "enrolment" }));
  }
}

/** GET /api/enrolments?studentId=... — Academic Admin, Super Admin, Management. */
export async function listEnrolments(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId, academicYear } = req.query as { studentId?: string; academicYear?: string };
    if (!studentId) throw ApiError.badRequest("studentId query parameter is required");

    const enrolments = await prisma.enrolment.findMany({
      where: { studentId, ...(academicYear ? { academicYear } : {}) },
      select: ENROLMENT_SELECT,
      orderBy: [{ academicYear: "desc" }, { semester: "asc" }],
    });

    return res.status(200).json({ enrolments });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/enrolments/mine — a Student's own subject enrolments. */
export async function listMyEnrolments(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
    if (!student) throw ApiError.notFound("Student profile not found");

    const enrolments = await prisma.enrolment.findMany({
      where: { studentId: student.id },
      select: ENROLMENT_SELECT,
      orderBy: [{ academicYear: "desc" }, { semester: "asc" }],
    });

    return res.status(200).json({ enrolments });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/enrolments/:id — Academic Admin, Super Admin. Typically used to withdraw/suspend an enrolment. */
export async function updateEnrolment(req: Request, res: Response, next: NextFunction) {
  try {
    const enrolment = await prisma.enrolment.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
      select: { ...ENROLMENT_SELECT, studentId: true },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "ENROLMENT_UPDATED",
      entityType: "Enrolment",
      entityId: enrolment.id,
      metadata: { status: enrolment.status },
      req,
    });

    return res.status(200).json(enrolment);
  } catch (err) {
    return next(toApiError(err, { entity: "enrolment" }));
  }
}
