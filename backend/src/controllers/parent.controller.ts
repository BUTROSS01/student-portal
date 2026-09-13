import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";

/**
 * GET /api/parents/me/students
 *
 * Returns only students explicitly linked to the authenticated parent via
 * StudentParentLink — a parent can never enumerate or guess their way into
 * another family's student record through this endpoint.
 */
export async function getMyLinkedStudents(req: Request, res: Response, next: NextFunction) {
  try {
    const parent = await prisma.parentGuardian.findUnique({
      where: { userId: req.user!.sub },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        students: {
          select: {
            relationship: true,
            isPrimary: true,
            student: {
              select: {
                id: true,
                studentNumber: true,
                firstName: true,
                lastName: true,
                enrolmentStatus: true,
                programme: { select: { name: true, code: true } },
                campus: { select: { name: true } },
              },
            },
          },
        },
      },
    });

    if (!parent) throw ApiError.notFound("Parent profile not found");

    return res.status(200).json({
      parent: { id: parent.id, firstName: parent.firstName, lastName: parent.lastName },
      students: parent.students.map((link) => ({
        ...link.student,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
      })),
    });
  } catch (err) {
    return next(err);
  }
}
