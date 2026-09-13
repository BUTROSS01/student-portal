import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { ApiError } from "../utils/apiError";
import { recordAuditLog } from "../utils/audit.util";
import { generateReceiptNumber } from "../utils/numbering.util";
import { notifyStudentAndParents } from "../utils/notify.util";
import { assertCanAccessStudent, getOwnStudentId } from "../utils/studentAccess.util";
import { SubmitPaymentInput, RejectPaymentInput } from "../validators/finance.validator";

const PAYMENT_SELECT = {
  id: true,
  amount: true,
  method: true,
  referenceNumber: true,
  status: true,
  submittedAt: true,
  verifiedAt: true,
  fee: { select: { id: true, description: true, academicYear: true, studentId: true } },
  proof: { select: { documentId: true } },
  receipt: { select: { id: true, receiptNumber: true, issuedAt: true } },
};

/**
 * POST /api/payments — Student or Parent submits a payment claim against a
 * fee, optionally referencing proof already uploaded via POST
 * /api/documents. Starts life as SUBMITTED; Finance moves it from there.
 */
export async function submitPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const input = req.body as SubmitPaymentInput;

    const fee = await prisma.fee.findUnique({ where: { id: input.feeId } });
    if (!fee) throw ApiError.notFound("Fee not found");
    await assertCanAccessStudent(req, fee.studentId);

    const payment = await prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          feeId: input.feeId,
          amount: input.amount,
          method: input.method,
          referenceNumber: input.referenceNumber,
          status: "SUBMITTED",
        },
        select: { ...PAYMENT_SELECT, id: true },
      });

      if (input.documentId) {
        await tx.paymentProof.create({
          data: { paymentId: created.id, documentId: input.documentId, uploadedById: req.user!.sub },
        });
      }

      if (fee.status === "PENDING") {
        await tx.fee.update({ where: { id: fee.id }, data: { status: "SUBMITTED" } });
      }

      return created;
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "PAYMENT_SUBMITTED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { feeId: input.feeId, amount: input.amount },
      req,
    });

    return res.status(201).json(payment);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/payments?status=&feeId= — Finance, Super Admin, Management. */
export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, feeId } = req.query as { status?: string; feeId?: string };
    const payments = await prisma.payment.findMany({
      where: { ...(status ? { status: status as any } : {}), ...(feeId ? { feeId } : {}) },
      select: PAYMENT_SELECT,
      orderBy: { submittedAt: "desc" },
    });
    return res.status(200).json({ payments });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/payments/mine — a Student's own payment history. */
export async function getMyPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const studentId = await getOwnStudentId(req);
    const payments = await prisma.payment.findMany({
      where: { fee: { studentId } },
      select: PAYMENT_SELECT,
      orderBy: { submittedAt: "desc" },
    });
    return res.status(200).json({ payments });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/payments/:id/verify — Finance confirms a payment: updates the
 * fee's running balance, recalculates PARTIALLY_PAID vs PAID_IN_FULL, and
 * issues a receipt — all in one transaction so a confirmed payment always
 * has a consistent balance and a receipt number, never one without the
 * other.
 */
export async function verifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const existing = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { fee: true } });
    if (!existing) throw ApiError.notFound("Payment not found");
    if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_VERIFICATION") {
      throw ApiError.badRequest("Only submitted payments can be verified");
    }

    const result = await prisma.$transaction(async (tx) => {
      const newAmountPaid = Number(existing.fee.amountPaid) + Number(existing.amount);
      const feeStatus = newAmountPaid >= Number(existing.fee.amountDue) ? "PAID_IN_FULL" : "PARTIALLY_PAID";

      await tx.fee.update({ where: { id: existing.fee.id }, data: { amountPaid: newAmountPaid, status: feeStatus } });

      const payment = await tx.payment.update({
        where: { id: existing.id },
        data: { status: "CONFIRMED", verifiedById: req.user!.sub, verifiedAt: new Date() },
        select: PAYMENT_SELECT,
      });

      const receiptNumber = await generateReceiptNumber(tx);
      await tx.receipt.create({ data: { paymentId: existing.id, receiptNumber } });

      return payment;
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "PAYMENT_VERIFIED",
      entityType: "Payment",
      entityId: existing.id,
      metadata: { amount: Number(existing.amount), feeId: existing.feeId },
      req,
    });
    await notifyStudentAndParents(
      existing.fee.studentId,
      "Payment confirmed",
      `Your payment of R${Number(existing.amount).toFixed(2)} for ${existing.fee.description} has been confirmed.`
    );

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/payments/:id/reject — Finance. Reason is recorded on the audit log (Payment has no reason field of its own). */
export async function rejectPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const { reason } = req.body as RejectPaymentInput;
    const existing = await prisma.payment.findUnique({ where: { id: req.params.id }, include: { fee: true } });
    if (!existing) throw ApiError.notFound("Payment not found");
    if (existing.status !== "SUBMITTED" && existing.status !== "UNDER_VERIFICATION") {
      throw ApiError.badRequest("Only submitted payments can be rejected");
    }

    const payment = await prisma.payment.update({
      where: { id: existing.id },
      data: { status: "REJECTED" },
      select: PAYMENT_SELECT,
    });

    await recordAuditLog({
      userId: req.user!.sub,
      action: "PAYMENT_REJECTED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: { reason },
      req,
    });
    await notifyStudentAndParents(
      existing.fee.studentId,
      "Payment could not be verified",
      `Your payment submission for ${existing.fee.description} was not confirmed: ${reason}. Please review and resubmit.`
    );

    return res.status(200).json(payment);
  } catch (err) {
    return next(err);
  }
}
