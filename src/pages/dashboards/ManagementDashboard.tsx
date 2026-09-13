import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { fetchReport } from "../../api/reporting";

const NAV = [
  { label: "Institutional KPIs", href: "/management" },
  { label: "Reports", href: "/management/reports" },
  { label: "Announcements", href: "/management/announcements" },
];

export function ManagementDashboard() {
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [feeCollectionRate, setFeeCollectionRate] = useState<number | null>(null);
  const [avgAttendance, setAvgAttendance] = useState<number | null>(null);
  const [passRate, setPassRate] = useState<number | null>(null);

  useEffect(() => {
    fetchReport("student-register").then((res) => setTotalStudents(res.rows.length)).catch(() => undefined);

    fetchReport("fee-collection")
      .then((res) => {
        const t = res.totals as { totalDue: number; totalPaid: number } | undefined;
        if (t && t.totalDue > 0) setFeeCollectionRate(Math.round((t.totalPaid / t.totalDue) * 10000) / 100);
      })
      .catch(() => undefined);

    fetchReport("academic-performance")
      .then((res) => setPassRate((res.overallPassRate as number | null) ?? null))
      .catch(() => undefined);

    fetchReport("attendance")
      .then((res) => {
        const rows = res.rows as { attendanceRate: number | null }[];
        const withRate = rows.filter((r) => r.attendanceRate !== null);
        if (withRate.length > 0) {
          setAvgAttendance(Math.round((withRate.reduce((s, r) => s + (r.attendanceRate ?? 0), 0) / withRate.length) * 100) / 100);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <DashboardLayout title="Institution-wide overview" navItems={NAV}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total enrolled students" value={totalStudents === null ? "—" : String(totalStudents)} />
        <StatCard label="Fee collection rate" value={feeCollectionRate === null ? "—" : `${feeCollectionRate}%`} accent="confirmed" />
        <StatCard label="Average attendance" value={avgAttendance === null ? "—" : `${avgAttendance}%`} />
        <StatCard label="Overall pass rate" value={passRate === null ? "—" : `${passRate}%`} accent="confirmed" />
      </div>
    </DashboardLayout>
  );
}
