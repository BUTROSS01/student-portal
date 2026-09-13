import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listStudents, StudentSummary } from "../../api/students";

const NAV = [
  { label: "Overview", href: "/academic" },
  { label: "Student registration", href: "/academic/registration" },
  { label: "Students", href: "/academic/students" },
  { label: "Results review", href: "/academic/results" },
  { label: "Announcements", href: "/academic/announcements" },
  { label: "Reports", href: "/academic/reports" },
];

const PAGE_SIZE = 20;

export function StudentsListPage() {
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timeout = setTimeout(() => {
      listStudents({ search: search || undefined, page, pageSize: PAGE_SIZE })
        .then((res) => {
          if (cancelled) return;
          setStudents(res.students);
          setTotal(res.total);
          setError(null);
        })
        .catch(() => !cancelled && setError("Couldn't load students. Please try again shortly."))
        .finally(() => !cancelled && setLoading(false));
    }, 300); // debounce search input

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <DashboardLayout title="Students" navItems={NAV}>
      <input
        type="search"
        placeholder="Search by name or student number…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="w-full max-w-sm rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500"
      />

      {error && <p className="mt-4 text-sm text-rejected">{error}</p>}

      <div className="mt-6 overflow-hidden border border-navy-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
            <tr>
              <th className="px-4 py-3 font-medium">Student number</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Programme</th>
              <th className="px-4 py-3 font-medium">Campus</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id} className="border-b border-navy-700/5 last:border-0">
                <td className="px-4 py-3 font-mono text-xs text-navy-700">{student.studentNumber}</td>
                <td className="px-4 py-3 text-ink">
                  {student.firstName} {student.lastName}
                </td>
                <td className="px-4 py-3 text-navy-700">{student.programme?.name ?? "—"}</td>
                <td className="px-4 py-3 text-navy-700">{student.campus?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={
                      student.enrolmentStatus === "ACTIVE"
                        ? "text-confirmed"
                        : student.enrolmentStatus === "WITHDRAWN"
                        ? "text-rejected"
                        : "text-navy-700"
                    }
                  >
                    {student.enrolmentStatus}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && students.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy-700">
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-navy-700">
        <span>
          {total} student{total === 1 ? "" : "s"}
        </span>
        <div className="space-x-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-sm border border-navy-700/30 px-3 py-1.5 disabled:opacity-40"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-sm border border-navy-700/30 px-3 py-1.5 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
