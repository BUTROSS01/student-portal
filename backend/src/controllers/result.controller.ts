import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { toApiError } from "../utils/prismaErrors";
import { calculateGrade } from "../utils/grading.util";
import { notifyUser, notifyStudentAndParents } from "../utils/notify.util";
import { EnterResultInput, UpdateResultInput, RejectResultInput, PublishResultsInput } from "../validators/result.validator";

const RESULT_SELECT = {
  id: true,
  marksObtained: true,
  maxMarks: true,
  percentage: true,
  grade: true,
  passed: true,
  status: true,
  publishedAt: true,
  createdAt: true,
  student: { select: { id: true, studentNumber: true, firstName: true, lastName: true } },
  subject: { select: { id: true, name: true, code: true, credits: true } },
  examination: { select: { id: true, name: true } },
};

/**
 * A Lecturer may only grade a student who is in one of their own classes,
 * in a subject that belongs to that class's programme, and only while the
 * student holds an active enrolment for that subject in the class's
 * academic year/semester. This is a deliberate simplification of the
 * schema (Class doesn't carry its own subject/lecturer-per-subject
 * assignment — see ARCHITECTURE.md) rather than a full timetable-driven
 * teaching assignment; it's the safest rule the current data model
 * actually supports.
 */
async function assertLecturerCanGrade(lecturerUserId: string, studentId: string, subjectId: string) {
  const staff = await prisma.staff.findUnique({ where: { userId: lecturerUserId } });
  if (!staff) throw ApiError.forbidden("No staff profile is linked to this account");

  const student = await prisma.student.findUnique({ where: { id: studentId }, include: { class: true } });
  if (!student?.class || student.class.lecturerId !== staff.id) {
    throw ApiError.forbidden("This student is not in one of your classes");
  }

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject || subject.programmeId !== student.class.programmeId) {
    throw ApiError.forbidden("This subject is not part of the student's programme");
  }

  const enrolment = await prisma.enrolment.findFirst({
    where: {
      studentId,
      subjectId,
      academicYear: student.class.academicYear,
      semester: student.class.semester,
    },
  });
  if (!enrolment) throw ApiError.forbidden("This student is not enrolled in this subject for the current term");

  return staff;
}

/** POST /api/results — Lecturer enters an initial mark (status starts at DRAFT). */
export async function enterResult(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as EnterResultInput;
    await assertLecturerCanGrade(req.user!.sub, input.studentId, input.subjectId);

    const existing = await prisma.result.findFirst({
      where: { studentId: input.studentId, subjectId: input.subjectId, examinationId: input.examinationId ?? null },
      select: { id: true, status: true },
    });
    if (existing) {
      throw ApiError.conflict(
        `A result already exists for this student and subject (status: ${existing.status}). Edit the existing entry instead of creating a new one.`
      );
    }

    const { percentage, grade, passed } = calculateGrade(input.marksObtained, input.maxMarks);

    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.result.create({
        data: {
          studentId: input.studentId,
          subjectId: input.subjectId,
          examinationId: input.examinationId,
          marksObtained: input.marksObtained,
          maxMarks: input.maxMarks,
          percentage,
          grade,
          passed,
          status: "DRAFT",
          enteredById: req.user!.sub,
        },
        select: { ...RESULT_SELECT, enteredById: true },
      });

      await tx.resultHistory.create({
        data: {
          resultId: created.id,
          changedById: req.user!.sub,
          previousValue: {},
          newValue: { marksObtained: input.marksObtained, maxMarks: input.maxMarks, percentage, grade, passed, status: "DRAFT" },
          reason: "Initial entry",
        },
      });

      return created;
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "RESULT_ENTERED",
      entityType: "Result",
      entityId: result.id,
      metadata: { studentId: input.studentId, subjectId: input.subjectId },
      req,
    });

    return res.status(201).json(result);
  } catch (err) {
    return next(toApiError(err, { entity: "result" }));
  }
}

/**
 * PATCH /api/results/:id — Lecturer corrects marks while the result is
 * still DRAFT or has been REJECTED. Every call writes a ResultHistory row
 * with the required `reason`; a REJECTED result moves back to DRAFT on
 * edit, ready to be resubmitted.
 */
export async function updateResult(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as UpdateResultInput;
    const existing = await prisma.result.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Result not found");
    if (existing.enteredById !== req.user!.sub) {
      throw ApiError.forbidden("You can only edit results you entered yourself");
    }
    if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
      throw ApiError.badRequest("This result has already been submitted and can no longer be edited directly");
    }

    const maxMarks = input.maxMarks ?? Number(existing.maxMarks);
    const { percentage, grade, passed } = calculateGrade(input.marksObtained, maxMarks);
    const newStatus = existing.status === "REJECTED" ? "DRAFT" : existing.status;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.result.update({
        where: { id: existing.id },
        data: { marksObtained: input.marksObtained, maxMarks, percentage, grade, passed, status: newStatus },
        select: RESULT_SELECT,
      });

      await tx.resultHistory.create({
        data: {
          resultId: updated.id,
          changedById: req.user!.sub,
          previousValue: {
            marksObtained: Number(existing.marksObtained),
            maxMarks: Number(existing.maxMarks),
            percentage: Number(existing.percentage),
            grade: existing.grade,
            passed: existing.passed,
            status: existing.status,
          },
          newValue: { marksObtained: input.marksObtained, maxMarks, percentage, grade, passed, status: newStatus },
          reason: input.reason,
        },
      });

      return updated;
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "RESULT_UPDATED",
      entityType: "Result",
      entityId: result.id,
      metadata: { reason: input.reason },
      req,
    });

    return res.status(200).json(result);
  } catch (err) {
    return next(toApiError(err, { entity: "result" }));
  }
}

/** POST /api/results/:id/submit — Lecturer moves a DRAFT result to SUBMITTED, locking it for review. */
export async function submitResult(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.result.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Result not found");
    if (existing.enteredById !== req.user!.sub) throw ApiError.forbidden();
    if (existing.status !== "DRAFT") throw ApiError.badRequest("Only draft results can be submitted for review");

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.result.update({
        where: { id: existing.id },
        data: { status: "SUBMITTED" },
        select: RESULT_SELECT,
      });
      await tx.resultHistory.create({
        data: {
          resultId: updated.id,
          changedById: req.user!.sub,
          previousValue: { status: "DRAFT" },
          newValue: { status: "SUBMITTED" },
          reason: "Submitted for academic review",
        },
      });
      return updated;
    });

    await recordAuditLog({ userId: req.user!.sub, action: "RESULT_SUBMITTED", entityType: "Result", entityId: result.id, req });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/results/:id/approve — Academic Admin. SUBMITTED (or UNDER_REVIEW) → APPROVED. */
export async function approveResult(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.result.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Result not found");
    if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_REVIEW") {
      throw ApiError.badRequest("Only submitted results can be approved");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.result.update({ where: { id: existing.id }, data: { status: "APPROVED" }, select: RESULT_SELECT });
      await tx.resultHistory.create({
        data: {
          resultId: updated.id,
          changedById: req.user!.sub,
          previousValue: { status: existing.status },
          newValue: { status: "APPROVED" },
          reason: "Approved by academic administration",
        },
      });
      return updated;
    });

    await recordAuditLog({ userId: req.user!.sub, action: "RESULT_APPROVED", entityType: "Result", entityId: result.id, req });
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/results/:id/reject — Academic Admin. SUBMITTED (or UNDER_REVIEW) → REJECTED, with a reason for the lecturer. */
export async function rejectResult(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as RejectResultInput;
    const existing = await prisma.result.findUnique({ where: { id: req.params.id } });
    if (!existing) throw ApiError.notFound("Result not found");
    if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_REVIEW") {
      throw ApiError.badRequest("Only submitted results can be rejected");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.result.update({ where: { id: existing.id }, data: { status: "REJECTED" }, select: RESULT_SELECT });
      await tx.resultHistory.create({
        data: {
          resultId: updated.id,
          changedById: req.user!.sub,
          previousValue: { status: existing.status },
          newValue: { status: "REJECTED" },
          reason,
        },
      });
      return updated;
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "RESULT_REJECTED",
      entityType: "Result",
      entityId: result.id,
      metadata: { reason },
      req,
    });
    await notifyUser(
      existing.enteredById,
      "A result needs correction",
      `Your mark entry for ${result.student.firstName} ${result.student.lastName} in ${result.subject.name} was returned: ${reason}`
    );
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/results/publish — Academic Admin. Publishes one or more
 * APPROVED results in a single batch (the common real workflow: approve a
 * class's results over a review session, then publish them together).
 * Results that aren't APPROVED are skipped and reported back rather than
 * failing the whole batch.
 */
export async function publishResults(req: Request, res: Response, next: NextFunction) {
  try {
    const { resultIds } = req.body as PublishResultsInput;

    const eligible = await prisma.result.findMany({
      where: { id: { in: resultIds }, status: "APPROVED" },
      select: { id: true },
    });
    const eligibleIds = eligible.map((r) => r.id);
    const skipped = resultIds.filter((id) => !eligibleIds.includes(id));

    if (eligibleIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        const now = new Date();
        await tx.result.updateMany({ where: { id: { in: eligibleIds } }, data: { status: "PUBLISHED", publishedAt: now } });

        await tx.resultHistory.createMany({
          data: eligibleIds.map((id) => ({
            resultId: id,
            changedById: req.user!.sub,
            previousValue: { status: "APPROVED" },
            newValue: { status: "PUBLISHED" },
            reason: "Published to student and parent",
          })),
        });
      });

      await recordAuditLog({
        userId: req.user!.sub,
        action: "RESULTS_PUBLISHED",
        entityType: "Result",
        metadata: { resultIds: eligibleIds },
        req,
      });

      const publishedResults = await prisma.result.findMany({
        where: { id: { in: eligibleIds } },
        select: { studentId: true, subject: { select: { name: true } } },
      });
      await Promise.all(
        publishedResults.map((r) =>
          notifyStudentAndParents(r.studentId, "New result published", `A result for ${r.subject.name} is now available.`)
        )
      );
    }

    return res.status(200).json({ published: eligibleIds, skipped });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/results — staff visibility. A Lecturer is always scoped to results they entered, regardless of query params. */
export async function listResults(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId, subjectId, status, academicYear, page, pageSize } = req.query as unknown as {
      studentId?: string;
      subjectId?: string;
      status?: string;
      academicYear?: string;
      page: number;
      pageSize: number;
    };
    void academicYear; // academic year lives on Enrolment/Class, not Result directly — filter client-side or via Module 5+ reporting once that join is needed.

    const where = {
      ...(studentId ? { studentId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(req.user!.role === "LECTURER" ? { enteredById: req.user!.sub } : {}),
    };

    const [total, results] = await Promise.all([
      prisma.result.count({ where }),
      prisma.result.findMany({
        where,
        select: RESULT_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return res.status(200).json({ total, page, pageSize, results });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/results/mine — a Student's own PUBLISHED results only. */
export async function getMyResults(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
    if (!student) throw ApiError.notFound("Student profile not found");

    const results = await prisma.result.findMany({
      where: { studentId: student.id, status: "PUBLISHED" },
      select: RESULT_SELECT,
      orderBy: { publishedAt: "desc" },
    });

    return res.status(200).json({ results });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/results/transcript/:studentId — PUBLISHED results only, grouped
 * for a transcript view. Available to staff roles, the student themselves,
 * or a parent explicitly linked to that student.
 */
export async function getTranscript(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId } = req.params;
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentNumber: true,
        firstName: true,
        lastName: true,
        userId: true,
        programme: { select: { name: true, code: true } },
      },
    });
    if (!student) throw ApiError.notFound("Student not found");

    const role = req.user!.role;
    if (role === "STUDENT" && student.userId !== req.user!.sub) throw ApiError.forbidden();
    if (role === "PARENT") {
      const link = await prisma.studentParentLink.findFirst({
        where: { studentId, parent: { userId: req.user!.sub } },
      });
      if (!link) throw ApiError.forbidden();
    }

    const results = await prisma.result.findMany({
      where: { studentId, status: "PUBLISHED" },
      select: RESULT_SELECT,
      orderBy: { publishedAt: "asc" },
    });

    const overallAverage =
      results.length > 0
        ? Math.round((results.reduce((sum, r) => sum + Number(r.percentage), 0) / results.length) * 100) / 100
        : null;

    return res.status(200).json({
      student: {
        id: student.id,
        studentNumber: student.studentNumber,
        name: `${student.firstName} ${student.lastName}`,
        programme: student.programme,
      },
      results,
      overallAverage,
      subjectsPassed: results.filter((r) => r.passed).length,
      subjectsFailed: results.filter((r) => !r.passed).length,
    });
  } catch (err) {
    return next(err);
  }
}
