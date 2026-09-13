import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { fetchMyStudentProfile, StudentDetail } from "../../api/students";
import { fetchMyResults, ResultSummary } from "../../api/results";
import { fetchMyFees, FeeSummaryResponse } from "../../api/finance";
import { fetchMyAttendance, AttendanceStats } from "../../api/attendance";

const NAV = [
  { label: "Overview", href: "/student" },
  { label: "Results", href: "/student/results" },
  { label: "Fees & Payments", href: "/student/fees" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Timetable", href: "/student/timetable" },
  { label: "Documents", href: "/student/documents" },
  { label: "Announcements", href: "/student/announcements" },
];

export function StudentDashboard() {
  const [profile, setProfile] = useState<StudentDetail | null>(null);
  const [results, setResults] = useState<ResultSummary[] | null>(null);
  const [fees, setFees] = useState<FeeSummaryResponse | null>(null);
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyStudentProfile().then(setProfile).catch(() => setError("Couldn't load your profile. Please try again shortly."));
    fetchMyResults().then(setResults).catch(() => undefined);
    fetchMyFees().then(setFees).catch(() => undefined);
    fetchMyAttendance().then((res) => setAttendance(res.stats)).catch(() => undefined);
  }, []);

  return (
    <DashboardLayout title={profile ? `Welcome, ${profile.firstName}` : "Welcome back"} navItems={NAV}>
      {error && <p className="text-sm text-rejected">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Student number" value={profile?.studentNumber ?? "—"} />
        <StatCard label="Programme" value={profile?.programme?.name ?? "Not yet allocated"} />
        <StatCard
          label="Fee balance"
          value={fees ? `R${fees.outstanding.toFixed(2)}` : "—"}
          accent={fees && fees.outstanding > 0 ? "gold" : "confirmed"}
        />
        <StatCard
          label="Attendance"
          value={attendance ? `${attendance.percentage}%` : "—"}
          accent={attendance && attendance.percentage < 80 ? "rejected" : "confirmed"}
        />
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg text-ink">Recent results</h2>
        {results && results.length === 0 && <p className="mt-2 text-sm text-navy-700">No published results yet.</p>}
        {results && results.length > 0 && (
          <div className="mt-3 overflow-hidden border border-navy-700/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Subject</th>
                  <th className="px-4 py-3 font-medium">Mark</th>
                  <th className="px-4 py-3 font-medium">Grade</th>
                  <th className="px-4 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 5).map((r) => (
                  <tr key={r.id} className="border-b border-navy-700/5 last:border-0">
                    <td className="px-4 py-3 text-ink">{r.subject.name}</td>
                    <td className="px-4 py-3 text-navy-700">
                      {r.marksObtained} / {r.maxMarks} ({r.percentage}%)
                    </td>
                    <td className="px-4 py-3 text-navy-700">{r.grade}</td>
                    <td className="px-4 py-3">
                      <span className={r.passed ? "text-confirmed" : "text-rejected"}>
                        {r.passed ? "Passed" : "Not yet passed"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
