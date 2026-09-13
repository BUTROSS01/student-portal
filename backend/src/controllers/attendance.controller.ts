import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { calculateAttendanceStats, checkAttendanceThreshold } from "../utils/attendance.util";
import { assertCanAccessStudent, getOwnStudentId } from "../utils/studentAccess.util";
import { RecordBulkAttendanceInput } from "../validators/attendance.validator";

/**
 * POST /api/attendance — Lecturer marks a whole class for one day in a
 * single call (upserting each student's entry against the
 * (studentId, classId, date) unique constraint, so re-submitting the same
 * day corrects rather than duplicates). Runs the low-attendance check for
 * every affected student afterwards.
 */
export async function recordAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as RecordBulkAttendanceInput;

    const klass = await prisma.class.findUnique({ where: { id: input.classId } });
    if (!klass) throw ApiError.notFound("Class not found");

    if (req.user!.role === "LECTURER") {
      const staff = await prisma.staff.findUnique({ where: { userId: req.user!.sub } });
      if (!staff || klass.lecturerId !== staff.id) throw ApiError.forbidden("This is not one of your classes");
    }

    await prisma.$transaction(
      input.records.map((entry) =>
        prisma.attendance.upsert({
          where: { studentId_classId_date: { studentId: entry.studentId, classId: input.classId, date: input.date } },
          update: { status: entry.status, comment: entry.comment, recordedById: req.user!.sub },
          create: {
            studentId: entry.studentId,
            classId: input.classId,
            date: input.date,
            status: entry.status,
            comment: entry.comment,
            recordedById: req.user!.sub,
          },
        })
      )
    );

    await recordAuditLog({
      userId: req.user!.sub,
      action: "ATTENDANCE_RECORDED",
      entityType: "Class",
      entityId: input.classId,
      metadata: { date: input.date, studentCount: input.records.length },
      req,
    });

    // Fire-and-forget per student — a slow notification pass shouldn't hold up the response.
    Promise.all(input.records.map((entry) => checkAttendanceThreshold(entry.studentId))).catch((err) =>
      console.error("Attendance threshold check failed", err)
    );

    return res.status(200).json({ message: "Attendance recorded", count: input.records.length });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/attendance?classId=&date= — Lecturer (own class), Academic Admin, Super Admin, Management. */
export async function listClassAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId, date } = req.query as { classId?: string; date?: string };
    if (!classId) throw ApiError.badRequest("classId is required");

    if (req.user!.role === "LECTURER") {
      const staff = await prisma.staff.findUnique({ where: { userId: req.user!.sub } });
      const klass = await prisma.class.findUnique({ where: { id: classId } });
      if (!staff || !klass || klass.lecturerId !== staff.id) throw ApiError.forbidden("This is not one of your classes");
    }

    const records = await prisma.attendance.findMany({
      where: { classId, ...(date ? { date: new Date(date) } : {}) },
      select: {
        id: true,
        date: true,
        status: true,
        comment: true,
        student: { select: { id: true, studentNumber: true, firstName: true, lastName: true } },
      },
      orderBy: [{ date: "desc" }, { student: { lastName: "asc" } }],
    });

    return res.status(200).json({ records });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/attendance/student/:studentId — staff, self, or a linked parent. Includes computed stats. */
export async function getStudentAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId } = req.params;
    await assertCanAccessStudent(req, studentId);

    const records = await prisma.attendance.findMany({
      where: { studentId },
      select: { id: true, date: true, status: true, comment: true, class: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    return res.status(200).json({ records, stats: calculateAttendanceStats(records) });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/attendance/mine — a Student's own attendance history and stats. */
export async function getMyAttendance(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getOwnStudentId(req);
    const records = await prisma.attendance.findMany({
      where: { studentId },
      select: { id: true, date: true, status: true, comment: true, class: { select: { name: true } } },
      orderBy: { date: "desc" },
    });
    return res.status(200).json({ records, stats: calculateAttendanceStats(records) });
  } catch (err) {
    return next(err);
  }
}
