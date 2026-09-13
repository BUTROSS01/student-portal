import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { CreateTimetableEntryInput } from "../validators/timetable.validator";

const TIMETABLE_SELECT = {
  id: true,
  dayOfWeek: true,
  startTime: true,
  endTime: true,
  room: true,
  class: { select: { id: true, name: true, programme: { select: { name: true } } } },
  examination: { select: { id: true, name: true, examDate: true, subjectId: true } },
};

/** POST /api/timetables — Super Admin, Academic Admin. */
export async function createTimetableEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateTimetableEntryInput;
    const entry = await prisma.timetable.create({ data: input, select: TIMETABLE_SELECT });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "TIMETABLE_ENTRY_CREATED",
      entityType: "Timetable",
      entityId: entry.id,
      req,
    });
    return res.status(201).json(entry);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/timetables?classId=&examinationId= — any authenticated staff user. */
export async function listTimetableEntries(req: Request, res: Response, next: NextFunction) {
  try {
    const { classId, examinationId } = req.query as { classId?: string; examinationId?: string };
    const entries = await prisma.timetable.findMany({
      where: { ...(classId ? { classId } : {}), ...(examinationId ? { examinationId } : {}) },
      select: TIMETABLE_SELECT,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return res.status(200).json({ entries });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/timetables/mine — resolves the caller's own class (Student) or classes (Lecturer) automatically. */
export async function listMyTimetable(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.user!.role;
    let classIds: string[] = [];

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
      if (!student) throw ApiError.notFound("Student profile not found");
      if (student.classId) classIds = [student.classId];
    } else if (role === "LECTURER") {
      const staff = await prisma.staff.findUnique({ where: { userId: req.user!.sub } });
      if (!staff) throw ApiError.notFound("Staff profile not found");
      classIds = (await prisma.class.findMany({ where: { lecturerId: staff.id }, select: { id: true } })).map((c) => c.id);
    } else {
      throw ApiError.badRequest("Only Students and Lecturers have a personal timetable — use /api/timetables instead");
    }

    const entries = await prisma.timetable.findMany({
      where: { classId: { in: classIds } },
      select: TIMETABLE_SELECT,
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return res.status(200).json({ entries });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/timetables/:id — Super Admin, Academic Admin. */
export async function deleteTimetableEntry(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.timetable.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      userId: req.user!.sub,
      action: "TIMETABLE_ENTRY_DELETED",
      entityType: "Timetable",
      entityId: req.params.id,
      req,
    });
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
}
