import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { listMyClasses, ClassSummary } from "../../api/academic";

const NAV = [
  { label: "My classes", href: "/lecturer" },
  { label: "Attendance", href: "/lecturer/attendance" },
  { label: "Marks entry", href: "/lecturer/marks" },
  { label: "Materials", href: "/lecturer/materials" },
  { label: "Announcements", href: "/lecturer/announcements" },
];

export function LecturerDashboard() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch(() => setError("Couldn't load your classes. Please try again shortly."));
  }, []);

  const totalStudents = classes?.reduce((sum, c) => sum + c._count.students, 0) ?? 0;

  return (
    <DashboardLayout title="Your classes" navItems={NAV}>
      {error && <p className="text-sm text-rejected">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Assigned classes" value={classes ? String(classes.length) : "—"} />
        <StatCard label="Total students" value={classes ? String(totalStudents) : "—"} />
        <StatCard label="Results awaiting submission" value="—" accent="gold" />
        <StatCard label="Average attendance" value="—" accent="confirmed" />
      </div>

      {classes && classes.length > 0 && (
        <div className="mt-8 overflow-hidden border border-navy-700/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
              <tr>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Programme</th>
                <th className="px-4 py-3 font-medium">Campus</th>
                <th className="px-4 py-3 font-medium">Students</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id} className="border-b border-navy-700/5 last:border-0">
                  <td className="px-4 py-3 text-ink">
                    {c.name}
                    <div className="text-xs text-navy-700">
                      {c.academicYear} · Semester {c.semester}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-navy-700">{c.programme.name}</td>
                  <td className="px-4 py-3 text-navy-700">{c.campus.name}</td>
                  <td className="px-4 py-3 text-navy-700">{c._count.students}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
