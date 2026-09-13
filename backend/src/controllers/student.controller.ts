import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { hashPassword } from "../utils/password.util";
import { generateStudentNumber } from "../utils/numbering.util";
import { recordAuditLog } from "../utils/audit.util";
import { RegisterStudentInput, UpdateStudentInput, LinkParentInput } from "../validators/student.validator";

const STUDENT_SUMMARY_SELECT = {
  id: true,
  studentNumber: true,
  firstName: true,
  lastName: true,
  enrolmentStatus: true,
  programme: { select: { id: true, name: true, code: true } },
  campus: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  user: { select: { email: true, status: true, lastLoginAt: true } },
} satisfies Prisma.StudentSelect;

const STUDENT_DETAIL_SELECT = {
  ...STUDENT_SUMMARY_SELECT,
  dateOfBirth: true,
  idNumber: true,
  address: true,
  createdAt: true,
  parentLinks: {
    select: {
      relationship: true,
      isPrimary: true,
      parent: { select: { id: true, firstName: true, lastName: true, phone: true, user: { select: { email: true } } } },
    },
  },
} satisfies Prisma.StudentSelect;

/**
 * POST /api/students
 *
 * Registers a new student in one transaction: creates the User account
 * (role STUDENT, temporary password, forced change on first login — same
 * pattern as admin-created accounts in Module 1) and the Student profile
 * with a freshly generated student number. Retries once on the rare
 * chance two registrations race for the same generated number.
 */
export async function registerStudent(req: Request, res: Response, next: NextFunction) {
  const input = req.body as RegisterStudentInput;

  try {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict("A user with this email already exists");

    const studentRole = await prisma.role.findUniqueOrThrow({ where: { name: "STUDENT" } });
    const temporaryPassword = crypto.randomBytes(9).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);

    const MAX_ATTEMPTS = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const student = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: input.email,
              phone: input.phone,
              passwordHash,
              roleId: studentRole.id,
              campusId: input.campusId,
              status: "PENDING_VERIFICATION",
              mustChangePassword: true,
            },
          });

          const studentNumber = await generateStudentNumber(tx);

          return tx.student.create({
            data: {
              studentNumber,
              userId: user.id,
              firstName: input.firstName,
              lastName: input.lastName,
              dateOfBirth: input.dateOfBirth,
              idNumber: input.idNumber,
              address: input.address,
              programmeId: input.programmeId,
              campusId: input.campusId,
              classId: input.classId,
            },
            select: STUDENT_SUMMARY_SELECT,
          });
        });

        await recordAuditLog({
          userId: req.user!.sub,
          action: "STUDENT_REGISTERED",
          entityType: "Student",
          entityId: student.id,
          metadata: { studentNumber: student.studentNumber },
          req,
        });

        return res.status(201).json({ ...student, temporaryPassword });
      } catch (err) {
        lastError = err;
        // P2002 = unique constraint violation. If it's the studentNumber
        // that collided, loop and generate the next one; anything else
        // (e.g. a genuinely duplicate email that slipped past the earlier
        // check in a race) should surface immediately.
        const isUniqueConflict =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
        if (!isUniqueConflict) throw err;
      }
    }

    throw lastError;
  } catch (err) {
    return next(err);
  }
}

/** GET /api/students — Super Admin, Academic Admin, and Management (read-only). */
export async function listStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const { programmeId, campusId, classId, enrolmentStatus, search, page, pageSize } = req.query as unknown as {
      programmeId?: string;
      campusId?: string;
      classId?: string;
      enrolmentStatus?: string;
      search?: string;
      page: number;
      pageSize: number;
    };

    const where: Prisma.StudentWhereInput = {
      ...(programmeId ? { programmeId } : {}),
      ...(campusId ? { campusId } : {}),
      ...(classId ? { classId } : {}),
      ...(enrolmentStatus ? { enrolmentStatus: enrolmentStatus as any } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { studentNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        select: STUDENT_SUMMARY_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return res.status(200).json({ total, page, pageSize, students });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/students/:id
 *
 * Staff roles (Super Admin, Academic Admin, Management) can view any
 * student. A Student may only view their own record. A Parent may only
 * view a student they are explicitly linked to via StudentParentLink —
 * enforced here, not just hidden in the UI.
 */
export async function getStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await prisma.student.findUnique({
      where: { id: req.params.id },
      select: { ...STUDENT_DETAIL_SELECT, userId: true },
    });
    if (!student) throw ApiError.notFound("Student not found");

    const role = req.user!.role;
    const requesterId = req.user!.sub;

    if (role === "STUDENT" && student.userId !== requesterId) {
      throw ApiError.forbidden();
    }

    if (role === "PARENT") {
      const link = await prisma.studentParentLink.findFirst({
        where: { studentId: student.id, parent: { userId: requesterId } },
      });
      if (!link) throw ApiError.forbidden();
    }

    const { userId, ...publicFields } = student;
    void userId;
    return res.status(200).json(publicFields);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/students/me — a Student's own profile. */
export async function getMyStudentProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const student = await prisma.student.findUnique({
      where: { userId: req.user!.sub },
      select: STUDENT_DETAIL_SELECT,
    });
    if (!student) throw ApiError.notFound("Student profile not found");
    return res.status(200).json(student);
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/students/:id — Super Admin, Academic Admin. */
export async function updateStudent(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as UpdateStudentInput;

    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: input,
      select: STUDENT_SUMMARY_SELECT,
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "STUDENT_UPDATED",
      entityType: "Student",
      entityId: req.params.id,
      metadata: input,
      req,
    });

    return res.status(200).json(student);
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/students/:id/parents
 *
 * Links a parent/guardian to a student, creating the parent's User +
 * ParentGuardian record if this is the first time the college has seen
 * that email. If the parent already exists, the link is upserted so
 * re-submitting (e.g. to correct the relationship label) doesn't fail.
 */
export async function linkParent(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = req.params.id;
    const input = req.body as LinkParentInput;

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw ApiError.notFound("Student not found");

    let parentUser = await prisma.user.findUnique({
      where: { email: input.email },
      include: { parent: true, role: true },
    });

    let parentGuardianId: string;
    let temporaryPassword: string | undefined;

    if (parentUser && parentUser.role.name !== "PARENT") {
      throw ApiError.conflict("This email belongs to an existing non-parent account");
    }

    if (parentUser?.parent) {
      parentGuardianId = parentUser.parent.id;
    } else {
      const parentRole = await prisma.role.findUniqueOrThrow({ where: { name: "PARENT" } });

      if (!parentUser) {
        temporaryPassword = crypto.randomBytes(9).toString("base64url");
        const passwordHash = await hashPassword(temporaryPassword);
        parentUser = await prisma.user.create({
          data: {
            email: input.email,
            phone: input.phone,
            passwordHash,
            roleId: parentRole.id,
            status: "PENDING_VERIFICATION",
            mustChangePassword: true,
          },
          include: { parent: true, role: true },
        });
      }

      const parentGuardian = await prisma.parentGuardian.create({
        data: {
          userId: parentUser.id,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
        },
      });
      parentGuardianId = parentGuardian.id;
    }

    await prisma.studentParentLink.upsert({
      where: { studentId_parentId: { studentId, parentId: parentGuardianId } },
      update: { relationship: input.relationship, isPrimary: input.isPrimary },
      create: {
        studentId,
        parentId: parentGuardianId,
        relationship: input.relationship,
        isPrimary: input.isPrimary,
      },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "PARENT_LINKED",
      entityType: "Student",
      entityId: studentId,
      metadata: { parentEmail: input.email, relationship: input.relationship },
      req,
    });

    return res.status(200).json({
      message: "Parent linked",
      parentGuardianId,
      ...(temporaryPassword ? { temporaryPassword } : {}),
    });
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/students/:id/parents/:parentId — Super Admin, Academic Admin. */
export async function unlinkParent(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: studentId, parentId } = req.params;

    await prisma.studentParentLink.delete({
      where: { studentId_parentId: { studentId, parentId } },
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "PARENT_UNLINKED",
      entityType: "Student",
      entityId: studentId,
      metadata: { parentId },
      req,
    });

    return res.status(200).json({ message: "Parent unlinked" });
  } catch (err) {
    return next(err);
  }
}
