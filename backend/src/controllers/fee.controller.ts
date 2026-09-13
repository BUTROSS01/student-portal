import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { recordAuditLog } from "../utils/audit.util";
import { toApiError } from "../utils/prismaErrors";
import { assertCanAccessStudent, getOwnStudentId } from "../utils/studentAccess.util";
import { CreateFeeInput, UpdateFeeInput } from "../validators/finance.validator";

const FEE_SELECT = {
  id: true,
  academicYear: true,
  description: true,
  amountDue: true,
  amountPaid: true,
  dueDate: true,
  status: true,
  createdAt: true,
};

/** POST /api/fees — Finance, Super Admin. Creates a fee line item for a student. */
export async function createFee(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as CreateFeeInput;
    const fee = await prisma.fee.create({ data: input, select: { ...FEE_SELECT, studentId: true } });
    await recordAuditLog({ userId: req.user!.sub, action: "FEE_CREATED", entityType: "Fee", entityId: fee.id, req });
    return res.status(201).json(fee);
  } catch (err) {
    return next(toApiError(err, { entity: "fee" }));
  }
}

/** GET /api/fees?studentId=&status= — Finance, Super Admin, Management. */
export async function listFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId, status } = req.query as { studentId?: string; status?: string };
    const fees = await prisma.fee.findMany({
      where: { ...(studentId ? { studentId } : {}), ...(status ? { status: status as any } : {}) },
      select: FEE_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ fees });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/fees/student/:studentId — staff, the student themselves, or a linked parent. */
export async function getStudentFees(req: Request, res: Response, next: NextFunction) {
  try {
    const { studentId } = req.params;
    await assertCanAccessStudent(req, studentId);

    const fees = await prisma.fee.findMany({
      where: { studentId },
      select: FEE_SELECT,
      orderBy: { createdAt: "desc" },
    });

    const totalDue = fees.reduce((sum, f) => sum + Number(f.amountDue), 0);
    const totalPaid = fees.reduce((sum, f) => sum + Number(f.amountPaid), 0);

    return res.status(200).json({ fees, totalDue, totalPaid, outstanding: totalDue - totalPaid });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/fees/mine — a Student's own fee summary. */
export async function getMyFees(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getOwnStudentId(req);
    const fees = await prisma.fee.findMany({ where: { studentId }, select: FEE_SELECT, orderBy: { createdAt: "desc" } });
    const totalDue = fees.reduce((sum, f) => sum + Number(f.amountDue), 0);
    const totalPaid = fees.reduce((sum, f) => sum + Number(f.amountPaid), 0);
    return res.status(200).json({ fees, totalDue, totalPaid, outstanding: totalDue - totalPaid });
  } catch (err) {
    return next(err);
  }
}

/** PATCH /api/fees/:id — Finance, Super Admin. Adjusts the fee line item itself (not payments). */
export async function updateFee(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as UpdateFeeInput;
    const fee = await prisma.fee.update({ where: { id: req.params.id }, data: input, select: FEE_SELECT });
    await recordAuditLog({ userId: req.user!.sub, action: "FEE_UPDATED", entityType: "Fee", entityId: fee.id, metadata: input, req });
    return res.status(200).json(fee);
  } catch (err) {
    return next(toApiError(err, { entity: "fee" }));
  }
}
