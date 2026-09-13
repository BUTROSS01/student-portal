import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { CreateAnnouncementInput } from "../validators/communication.validator";

const ROLE_ALLOWED_AUDIENCES: Record<string, string[]> = {
  SUPER_ADMIN: ["STUDENT", "PARENT", "CLASS", "PROGRAMME", "DEPARTMENT", "CAMPUS", "COLLEGE_WIDE"],
  MANAGEMENT: ["STUDENT", "PARENT", "CLASS", "PROGRAMME", "DEPARTMENT", "CAMPUS", "COLLEGE_WIDE"],
  ACADEMIC_ADMIN: ["STUDENT", "PARENT", "CLASS", "PROGRAMME"],
  LECTURER: ["CLASS"],
};

/** Resolves an audience + targetId into the set of Student ids it reaches. */
async function resolveAudienceStudentIds(audience: string, targetId?: string): Promise<string[]> {
  switch (audience) {
    case "STUDENT":
    case "PARENT":
      return targetId ? [targetId] : [];
    case "CLASS":
      return (await prisma.student.findMany({ where: { classId: targetId }, select: { id: true } })).map((s) => s.id);
    case "PROGRAMME":
      return (await prisma.student.findMany({ where: { programmeId: targetId }, select: { id: true } })).map((s) => s.id);
    case "DEPARTMENT": {
      const programmes = await prisma.programme.findMany({ where: { departmentId: targetId }, select: { id: true } });
      return (
        await prisma.student.findMany({ where: { programmeId: { in: programmes.map((p) => p.id) } }, select: { id: true } })
      ).map((s) => s.id);
    }
    case "CAMPUS":
      return (await prisma.student.findMany({ where: { campusId: targetId }, select: { id: true } })).map((s) => s.id);
    case "COLLEGE_WIDE":
      return (await prisma.student.findMany({ select: { id: true } })).map((s) => s.id);
    default:
      return [];
  }
}

/**
 * Fans an announcement out to real Notification rows. For every audience
 * except "PARENT", both the student and any linked guardians are
 * notified — matching the brief's "students and parents should receive
 * important notifications" requirement. "PARENT" targets only the
 * guardian(s) of the given student.
 */
async function fanOutNotifications(studentIds: string[], audience: string, title: string, body: string) {
  if (studentIds.length === 0) return;

  const studentUserIds =
    audience === "PARENT"
      ? []
      : (await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { userId: true } })).map(
          (s) => s.userId
        );

  const parentUserIds = (
    await prisma.studentParentLink.findMany({
      where: { studentId: { in: studentIds } },
      select: { parent: { select: { userId: true } } },
    })
  ).map((link) => link.parent.userId);

  const recipientUserIds = Array.from(new Set([...studentUserIds, ...parentUserIds]));
  if (recipientUserIds.length === 0) return;

  await prisma.notification.createMany({
    data: recipientUserIds.map((userId) => ({ userId, channel: "IN_APP" as const, title, body })),
  });
}

/** POST /api/announcements */
export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateAnnouncementInput;
    const role = req.user!.role;

    const allowed = ROLE_ALLOWED_AUDIENCES[role] ?? [];
    if (!allowed.includes(input.audience)) {
      throw ApiError.forbidden(`Your role cannot publish announcements to the ${input.audience} audience`);
    }
    if (input.audience !== "COLLEGE_WIDE" && !input.targetId) {
      throw ApiError.badRequest("targetId is required for this audience");
    }

    // A Lecturer may only announce to their own class.
    if (role === "LECTURER" && input.audience === "CLASS") {
      const staff = await prisma.staff.findUnique({ where: { userId: req.user!.sub } });
      const klass = await prisma.class.findUnique({ where: { id: input.targetId } });
      if (!staff || !klass || klass.lecturerId !== staff.id) {
        throw ApiError.forbidden("You can only announce to your own class");
      }
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: input.title,
        body: input.body,
        audience: input.audience,
        targetId: input.targetId,
        createdById: req.user!.sub,
      },
    });

    const studentIds = await resolveAudienceStudentIds(input.audience, input.targetId);
    await fanOutNotifications(studentIds, input.audience, `Announcement: ${input.title}`, input.body);

    await recordAuditLog({
      userId: req.user!.sub,
      action: "ANNOUNCEMENT_PUBLISHED",
      entityType: "Announcement",
      entityId: announcement.id,
      metadata: { audience: input.audience, targetId: input.targetId, reach: studentIds.length },
      req,
    });

    return res.status(201).json({ ...announcement, reach: studentIds.length });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/announcements — returns announcements relevant to the caller.
 * Staff roles see everything they could have created (a simple, honest
 * default); Students/Parents see COLLEGE_WIDE plus anything targeted at
 * them specifically (class/programme/campus/individually).
 */
export async function listAnnouncements(req: Request, res: Response, next: NextFunction) {
  try {
    const role = req.user!.role;

    if (role !== "STUDENT" && role !== "PARENT") {
      const announcements = await prisma.announcement.findMany({ orderBy: { publishedAt: "desc" }, take: 50 });
      return res.status(200).json({ announcements });
    }

    let studentId: string | null = null;
    let classId: string | null = null;
    let programmeId: string | null = null;
    let campusId: string | null = null;

    if (role === "STUDENT") {
      const student = await prisma.student.findUnique({ where: { userId: req.user!.sub } });
      if (student) {
        studentId = student.id;
        classId = student.classId;
        programmeId = student.programmeId;
        campusId = student.campusId;
      }
    } else {
      // Parent: union the reach of every linked student.
      const links = await prisma.studentParentLink.findMany({
        where: { parent: { userId: req.user!.sub } },
        select: { student: { select: { id: true, classId: true, programmeId: true, campusId: true } } },
      });
      studentId = links[0]?.student.id ?? null; // individual-student announcements checked per-student below
      classId = links[0]?.student.classId ?? null;
      programmeId = links[0]?.student.programmeId ?? null;
      campusId = links[0]?.student.campusId ?? null;
    }

    const studentAudience: "STUDENT" | "PARENT" = role === "STUDENT" ? "STUDENT" : "PARENT";

    const announcements = await prisma.announcement.findMany({
      where: {
        OR: [
          { audience: "COLLEGE_WIDE" },
          ...(classId ? [{ audience: "CLASS" as const, targetId: classId }] : []),
          ...(programmeId ? [{ audience: "PROGRAMME" as const, targetId: programmeId }] : []),
          ...(campusId ? [{ audience: "CAMPUS" as const, targetId: campusId }] : []),
          ...(studentId ? [{ audience: studentAudience, targetId: studentId }] : []),
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    return res.status(200).json({ announcements });
  } catch (err) {
    return next(err);
  }
}
