import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { toCsv } from "../utils/csv.util";

function respondReport(req: Request, res: Response, rows: Record<string, unknown>[], filename: string) {
  if (req.query.format === "csv") {
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.status(200).send(toCsv(rows));
  }
  return res.status(200).json({ rows });
}

/** GET /api/reports/student-register — Super Admin, Academic Admin, Management. */
export async function studentRegisterReport(req: Request, res: Response, next: NextFunction) {
  try {
    const students = await prisma.student.findMany({
      select: {
        studentNumber: true,
        firstName: true,
        lastName: true,
        enrolmentStatus: true,
        programme: { select: { name: true, code: true } },
        campus: { select: { name: true } },
        user: { select: { email: true, status: true } },
      },
      orderBy: { studentNumber: "asc" },
    });

    const rows = students.map((s) => ({
      studentNumber: s.studentNumber,
      name: `${s.firstName} ${s.lastName}`,
      email: s.user.email,
      programme: s.programme?.name ?? "",
      campus: s.campus?.name ?? "",
      enrolmentStatus: s.enrolmentStatus,
      accountStatus: s.user.status,
    }));

    return respondReport(req, res, rows, "student-register");
  } catch (err) {
    return next(err);
  }
}

/** GET /api/reports/fee-collection — Finance, Super Admin, Management. */
export async function feeCollectionReport(req: Request, res: Response, next: NextFunction) {
  try {
    const fees = await prisma.fee.findMany({
      select: {
        academicYear: true,
        description: true,
        amountDue: true,
        amountPaid: true,
        status: true,
        student: { select: { studentNumber: true, firstName: true, lastName: true, programme: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = fees.map((f) => ({
      studentNumber: f.student.studentNumber,
      student: `${f.student.firstName} ${f.student.lastName}`,
      programme: f.student.programme?.name ?? "",
      academicYear: f.academicYear,
      description: f.description,
      amountDue: Number(f.amountDue),
      amountPaid: Number(f.amountPaid),
      outstanding: Number(f.amountDue) - Number(f.amountPaid),
      status: f.status,
    }));

    const totals = {
      totalDue: rows.reduce((s, r) => s + r.amountDue, 0),
      totalPaid: rows.reduce((s, r) => s + r.amountPaid, 0),
      totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0),
    };

    if (req.query.format === "csv") return respondReport(req, res, rows, "fee-collection");
    return res.status(200).json({ rows, totals });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/reports/academic-performance — Academic Admin, Super Admin, Management. */
export async function academicPerformanceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const results = await prisma.result.findMany({
      where: { status: "PUBLISHED" },
      select: { percentage: true, passed: true, subject: { select: { name: true, code: true } } },
    });

    const bySubject = new Map<string, { subject: string; count: number; passCount: number; totalPercentage: number }>();
    for (const r of results) {
      const key = r.subject.code;
      const entry = bySubject.get(key) ?? { subject: `${r.subject.name} (${r.subject.code})`, count: 0, passCount: 0, totalPercentage: 0 };
      entry.count += 1;
      entry.passCount += r.passed ? 1 : 0;
      entry.totalPercentage += Number(r.percentage);
      bySubject.set(key, entry);
    }

    const rows = Array.from(bySubject.values()).map((e) => ({
      subject: e.subject,
      resultsPublished: e.count,
      passRate: Math.round((e.passCount / e.count) * 10000) / 100,
      averagePercentage: Math.round((e.totalPercentage / e.count) * 100) / 100,
    }));

    const overallPassRate =
      results.length > 0 ? Math.round((results.filter((r) => r.passed).length / results.length) * 10000) / 100 : null;

    if (req.query.format === "csv") return respondReport(req, res, rows, "academic-performance");
    return res.status(200).json({ rows, overallPassRate, totalPublishedResults: results.length });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/reports/attendance — Academic Admin, Super Admin, Management. */
export async function attendanceReport(req: Request, res: Response, next: NextFunction) {
  try {
    const classes = await prisma.class.findMany({
      select: {
        name: true,
        programme: { select: { name: true } },
        attendance: { select: { status: true } },
      },
    });

    const rows = classes.map((c) => {
      const total = c.attendance.filter((a) => a.status !== "EXCUSED").length;
      const attended = c.attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
      return {
        class: c.name,
        programme: c.programme.name,
        recordsCount: c.attendance.length,
        attendanceRate: total > 0 ? Math.round((attended / total) * 10000) / 100 : null,
      };
    });

    return respondReport(req, res, rows, "attendance");
  } catch (err) {
    return next(err);
  }
}
