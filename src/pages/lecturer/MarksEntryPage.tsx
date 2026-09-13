import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listMyClasses, listSubjects, listClassStudents, ClassSummary, Subject, RosterStudent } from "../../api/academic";
import { listResults, enterResult, updateResult, submitResult, ResultSummary } from "../../api/results";

const NAV = [
  { label: "My classes", href: "/lecturer" },
  { label: "Attendance", href: "/lecturer/attendance" },
  { label: "Marks entry", href: "/lecturer/marks" },
  { label: "Materials", href: "/lecturer/materials" },
  { label: "Announcements", href: "/lecturer/announcements" },
];

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  PUBLISHED: "Published",
  REJECTED: "Rejected — revise and resubmit",
};

export function MarksEntryPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [resultsByStudent, setResultsByStudent] = useState<Record<string, ResultSummary>>({});
  const [drafts, setDrafts] = useState<Record<string, { marks: string; reason: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listMyClasses().then(setClasses).catch(() => undefined);
  }, []);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId), [classes, classId]);

  useEffect(() => {
    setSubjectId("");
    setSubjects([]);
    setRoster([]);
    setResultsByStudent({});
    if (!classId) return;

    listSubjects(selectedClass?.programme.id).then(setSubjects).catch(() => undefined);
    listClassStudents(classId).then(setRoster).catch(() => setError("Couldn't load the class roster."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function loadResultsForSubject() {
    if (!subjectId) return;
    setLoading(true);
    try {
      const { results } = await listResults({ subjectId });
      const map: Record<string, ResultSummary> = {};
      for (const r of results) map[r.student.id] = r;
      setResultsByStudent(map);
      const nextDrafts: Record<string, { marks: string; reason: string }> = {};
      for (const student of roster) {
        const existing = map[student.id];
        nextDrafts[student.id] = { marks: existing ? existing.marksObtained : "", reason: "" };
      }
      setDrafts(nextDrafts);
    } catch {
      setError("Couldn't load existing results for this subject.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResultsForSubject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, roster]);

  function setDraft(studentId: string, patch: Partial<{ marks: string; reason: string }>) {
    setDrafts((prev) => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  async function handleSave(studentId: string) {
    setError(null);
    const draft = drafts[studentId];
    const existing = resultsByStudent[studentId];

    try {
      if (!existing) {
        const created = await enterResult({
          studentId,
          subjectId,
          marksObtained: Number(draft.marks),
        });
        setResultsByStudent((prev) => ({ ...prev, [studentId]: created }));
      } else {
        if (!draft.reason.trim()) {
          setError("A short reason is required whenever you change a mark.");
          return;
        }
        const updated = await updateResult(existing.id, {
          marksObtained: Number(draft.marks),
          reason: draft.reason,
        });
        setResultsByStudent((prev) => ({ ...prev, [studentId]: updated }));
        setDraft(studentId, { reason: "" });
      }
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't save this mark. Please try again.");
    }
  }

  async function handleSubmit(studentId: string) {
    setError(null);
    const existing = resultsByStudent[studentId];
    if (!existing) return;
    try {
      const updated = await submitResult(existing.id);
      setResultsByStudent((prev) => ({ ...prev, [studentId]: updated }));
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't submit this result. Please try again.");
    }
  }

  const inputClass =
    "w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2 text-sm text-ink focus-visible:border-gold-500";

  return (
    <DashboardLayout title="Marks entry" navItems={NAV}>
      {error && (
        <p role="alert" className="mb-6 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-xl">
        <div>
          <label className="block text-sm font-medium text-ink">Class</label>
          <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`mt-1.5 ${inputClass}`}>
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.academicYear} · Sem {c.semester})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!classId}
            className={`mt-1.5 ${inputClass} disabled:bg-navy-700/5`}
          >
            <option value="">Select a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {classId && subjectId && (
        <div className="mt-8 overflow-hidden border border-navy-700/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Marks (of 100)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reason for change</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((student) => {
                const existing = resultsByStudent[student.id];
                const draft = drafts[student.id] ?? { marks: "", reason: "" };
                const editable = !existing || existing.status === "DRAFT" || existing.status === "REJECTED";

                return (
                  <tr key={student.id} className="border-b border-navy-700/5 last:border-0">
                    <td className="px-4 py-3 text-ink">
                      {student.firstName} {student.lastName}
                      <div className="text-xs text-navy-700">{student.studentNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={draft.marks}
                        disabled={!editable}
                        onChange={(e) => setDraft(student.id, { marks: e.target.value })}
                        className="w-24 rounded-sm border border-navy-700/30 bg-white px-2 py-1.5 text-ink disabled:bg-navy-700/5"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          existing?.status === "REJECTED"
                            ? "text-rejected"
                            : existing?.status === "PUBLISHED" || existing?.status === "APPROVED"
                            ? "text-confirmed"
                            : "text-navy-700"
                        }
                      >
                        {existing ? STATUS_LABEL[existing.status] : "Not yet entered"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {existing && editable && (
                        <input
                          placeholder="Why is this changing?"
                          value={draft.reason}
                          onChange={(e) => setDraft(student.id, { reason: e.target.value })}
                          className="w-full rounded-sm border border-navy-700/30 bg-white px-2 py-1.5 text-xs text-ink"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editable && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSave(student.id)}
                            disabled={!draft.marks}
                            className="rounded-sm bg-navy-900 px-3 py-1.5 text-xs font-medium text-paper hover:bg-navy-800 disabled:opacity-40"
                          >
                            {existing ? "Update" : "Save"}
                          </button>
                          {existing?.status === "DRAFT" && (
                            <button
                              onClick={() => handleSubmit(student.id)}
                              className="rounded-sm border border-navy-700/30 px-3 py-1.5 text-xs font-medium text-ink hover:bg-navy-700/5"
                            >
                              Submit
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {roster.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-navy-700">
                    No students in this class yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
