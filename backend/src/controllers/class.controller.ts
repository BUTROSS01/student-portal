import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { toApiError } from "../utils/prismaErrors";
import { ClassInput } from "../validators/academic.validator";

const CLASS_SELECT = {
  id: true,
  name: true,
  academicYear: true,
  semester: true,
  programme: { select: { id: true, name: true, code: true } },
  campus: { select: { id: true, name: true } },
  lecturer: { select: { id: true, firstName: true, lastName: true } },
  _count: { select: { students: true } },
};

/** GET /api/classes/:id/students — the roster for one class. Lecturer (own class only), Academic Admin, Super Admin. */
export async function listClassStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const klass = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!klass) throw ApiError.notFound("Class not found");

    if (req.user!.role === "LECTURER") {
      const staff = await prisma.staff.findUnique({ where: { userId: req.user!.sub } });
      if (!staff || klass.lecturerId !== staff.id) throw ApiError.forbidden("This is not one of your classes");
    }

    const students = await prisma.student.findMany({
      where: { classId: klass.id },
      select: { id: true, studentNumber: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    });

    return res.status(200).json({ students });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/classes — any authenticated staff user; filterable by programme/campus/year/lecturer. */
export async function listClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const { programmeId, campusId, academicYear, lecturerId } = req.query as {
      programmeId?: string;
      campusId?: string;
      academicYear?: string;
      lecturerId?: string;
    };

    const classes = await prisma.class.findMany({
      where: {
        ...(programmeId ? { programmeId } : {}),
        ...(campusId ? { campusId } : {}),
        ...(academicYear ? { academicYear } : {}),
        ...(lecturerId ? { lecturerId } : {}),
      },
      select: CLASS_SELECT,
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
    });

    return res.status(200).json({ classes });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/classes/mine — a Lecturer's own assigned classes. */
export async function listMyClasses(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await prisma.staff.findUnique({ where: { userId: req.user!.sub } });
    if (!staff) throw ApiError.notFound("Staff profile not found for this account");

    const classes = await prisma.class.findMany({
      where: { lecturerId: staff.id },
      select: CLASS_SELECT,
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
    });

    return res.status(200).json({ classes });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/classes — Super Admin, Academic Admin. */
export async function createClass(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as ClassInput;
    const klass = await prisma.class.create({ data: input, select: CLASS_SELECT });
    await recordAuditLog({ userId: req.user!.sub, action: "CLASS_CREATED", entityType: "Class", entityId: klass.id, req });
    return res.status(201).json(klass);
  } catch (err) {
    return next(toApiError(err, { entity: "class" }));
  }
}

/** PATCH /api/classes/:id — Super Admin, Academic Admin. */
export async function updateClass(req: Request, res: Response, next: NextFunction) {
  try {
    const klass = await prisma.class.update({
      where: { id: req.params.id },
      data: req.body as Partial<ClassInput>,
      select: CLASS_SELECT,
    });
    await recordAuditLog({ userId: req.user!.sub, action: "CLASS_UPDATED", entityType: "Class", entityId: klass.id, req });
    return res.status(200).json(klass);
  } catch (err) {
    return next(toApiError(err, { entity: "class" }));
  }
}

/** DELETE /api/classes/:id — Super Admin, Academic Admin. */
export async function deleteClass(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.class.delete({ where: { id: req.params.id } });
    await recordAuditLog({ userId: req.user!.sub, action: "CLASS_DELETED", entityType: "Class", entityId: req.params.id, req });
    return res.status(204).send();
  } catch (err) {
    return next(toApiError(err, { entity: "class" }));
  }
}
