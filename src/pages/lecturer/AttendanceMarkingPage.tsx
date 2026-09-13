import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listMyClasses, listClassStudents, ClassSummary, RosterStudent } from "../../api/academic";
import { listClassAttendance, recordAttendance } from "../../api/attendance";

const NAV = [
  { label: "My classes", href: "/lecturer" },
  { label: "Attendance", href: "/lecturer/attendance" },
  { label: "Marks entry", href: "/lecturer/marks" },
  { label: "Materials", href: "/lecturer/materials" },
  { label: "Announcements", href: "/lecturer/announcements" },
];

const STATUS_OPTIONS = ["PRESENT", "ABSENT", "LATE", "EXCUSED"] as const;

export function AttendanceMarkingPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    listMyClasses().then(setClasses).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!classId) {
      setRoster([]);
      return;
    }
    listClassStudents(classId).then((students) => {
      setRoster(students);
      // Pre-fill with existing attendance for this date, defaulting everyone else to PRESENT.
      listClassAttendance(classId, date).then((existing) => {
        const next: Record<string, string> = {};
        for (const s of students) next[s.id] = "PRESENT";
        for (const record of existing) next[record.student.id] = record.status;
        setMarks(next);
      });
    });
  }, [classId, date]);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      await recordAttendance({
        classId,
        date,
        records: roster.map((s) => ({ studentId: s.id, status: marks[s.id] ?? "PRESENT" })),
      });
      setNotice("Attendance saved.");
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save attendance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "rounded-sm border border-navy-700/30 bg-white px-3 py-2 text-sm text-ink focus-visible:border-gold-500";

  return (
    <DashboardLayout title="Attendance" navItems={NAV}>
      {notice && <p className="mb-4 border border-confirmed/30 bg-confirmed/5 px-3 py-2 text-sm text-confirmed">{notice}</p>}
      {error && <p className="mb-4 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>}

      <div className="flex flex-wrap gap-4">
        <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputClass}>
          <option value="">Select a class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
      </div>

      {classId && roster.length > 0 && (
        <>
          <div className="mt-6 overflow-hidden border border-navy-700/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Student</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((s) => (
                  <tr key={s.id} className="border-b border-navy-700/5 last:border-0">
                    <td className="px-4 py-3 text-ink">
                      {s.firstName} {s.lastName}
                      <div className="text-xs text-navy-700">{s.studentNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        {STATUS_OPTIONS.map((status) => (
                          <label key={status} className="flex items-center gap-1 text-xs text-navy-700">
                            <input
                              type="radio"
                              name={`status-${s.id}`}
                              checked={(marks[s.id] ?? "PRESENT") === status}
                              onChange={() => setMarks((prev) => ({ ...prev, [s.id]: status }))}
                            />
                            {status.charAt(0) + status.slice(1).toLowerCase()}
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-4 rounded-sm bg-navy-900 px-5 py-2.5 font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save attendance"}
          </button>
        </>
      )}
    </DashboardLayout>
  );
}
