import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { fetchMyLinkedStudents, LinkedStudent } from "../../api/parents";
import { fetchStudentFees, FeeSummaryResponse } from "../../api/finance";

const NAV = [
  { label: "Overview", href: "/parent" },
  { label: "Linked students", href: "/parent/students" },
  { label: "Fees & Payments", href: "/parent/fees" },
  { label: "Attendance", href: "/parent/attendance" },
  { label: "Announcements", href: "/parent/announcements" },
];

export function ParentDashboard() {
  const [students, setStudents] = useState<LinkedStudent[] | null>(null);
  const [feesByStudent, setFeesByStudent] = useState<Record<string, FeeSummaryResponse>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyLinkedStudents()
      .then((res) => {
        setStudents(res.students);
        res.students.forEach((s) => {
          fetchStudentFees(s.id)
            .then((fees) => setFeesByStudent((prev) => ({ ...prev, [s.id]: fees })))
            .catch(() => undefined);
        });
      })
      .catch(() => setError("Couldn't load your linked students. Please try again shortly."));
  }, []);

  return (
    <DashboardLayout title="Your linked students" navItems={NAV}>
      {error && <p className="text-sm text-rejected">{error}</p>}

      {students && students.length === 0 && (
        <p className="text-sm text-navy-700">
          No students are linked to your account yet. Contact the college registrar to have a student linked.
        </p>
      )}

      <div className="space-y-4">
        {students?.map((student) => {
          const fees = feesByStudent[student.id];
          return (
            <div key={student.id} className="border border-navy-700/10 border-b-2 border-b-gold-500 bg-white px-5 py-4">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-lg text-ink">
                  {student.firstName} {student.lastName}
                </p>
                <span className="text-xs uppercase tracking-wide text-navy-700">{student.relationship}</span>
              </div>
              <p className="text-sm text-navy-700">{student.studentNumber}</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Programme" value={student.programme?.name ?? "Not yet allocated"} />
                <StatCard label="Campus" value={student.campus?.name ?? "Not yet allocated"} />
                <StatCard
                  label="Status"
                  value={student.enrolmentStatus}
                  accent={student.enrolmentStatus === "ACTIVE" ? "confirmed" : "gold"}
                />
                <StatCard
                  label="Outstanding fees"
                  value={fees ? `R${fees.outstanding.toFixed(2)}` : "—"}
                  accent={fees && fees.outstanding > 0 ? "gold" : "confirmed"}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardLayout>
  );
}
