import { FormEvent, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { createFee } from "../../api/finance";
import { listStudents, StudentSummary } from "../../api/students";

const NAV = [
  { label: "Overview", href: "/finance" },
  { label: "Create fee", href: "/finance/create-fee" },
  { label: "Payments awaiting verification", href: "/finance/verification" },
  { label: "Reports", href: "/finance/reports" },
];

export function CreateFeePage() {
  const [studentSearch, setStudentSearch] = useState("");
  const [matches, setMatches] = useState<StudentSummary[]>([]);
  const [studentId, setStudentId] = useState("");
  const [studentLabel, setStudentLabel] = useState("");
  const [form, setForm] = useState({
    academicYear: new Date().getFullYear().toString(),
    description: "",
    amountDue: "",
    dueDate: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSearch(value: string) {
    setStudentSearch(value);
    setStudentId("");
    if (value.length < 2) {
      setMatches([]);
      return;
    }
    const res = await listStudents({ search: value, page: 1, pageSize: 5 });
    setMatches(res.students);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!studentId) {
      setError("Select a student from the search results first.");
      return;
    }
    setSubmitting(true);
    try {
      await createFee({
        studentId,
        academicYear: form.academicYear,
        description: form.description,
        amountDue: Number(form.amountDue),
        dueDate: form.dueDate || undefined,
      });
      setNotice(`Fee account created for ${studentLabel}.`);
      setForm({ academicYear: new Date().getFullYear().toString(), description: "", amountDue: "", dueDate: "" });
      setStudentSearch("");
      setStudentId("");
      setMatches([]);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't create the fee. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500";

  return (
    <DashboardLayout title="Create a fee account" navItems={NAV}>
      {notice && <p className="mb-4 border border-confirmed/30 bg-confirmed/5 px-3 py-2 text-sm text-confirmed">{notice}</p>}
      {error && <p className="mb-4 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>}

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink">Student</label>
          <input
            value={studentId ? studentLabel : studentSearch}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name or student number"
            className={`mt-1.5 ${inputClass}`}
          />
          {matches.length > 0 && !studentId && (
            <ul className="mt-1 border border-navy-700/10 bg-white text-sm">
              {matches.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setStudentId(s.id);
                      setStudentLabel(`${s.firstName} ${s.lastName} (${s.studentNumber})`);
                      setMatches([]);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-navy-700/5"
                  >
                    {s.firstName} {s.lastName} — {s.studentNumber}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Description</label>
          <input
            required
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="e.g. Tuition Semester 1"
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink">Academic year</label>
            <input
              required
              value={form.academicYear}
              onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink">Amount due (R)</label>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              value={form.amountDue}
              onChange={(e) => setForm((f) => ({ ...f, amountDue: e.target.value }))}
              className={`mt-1.5 ${inputClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Due date (optional)</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
            className={`mt-1.5 ${inputClass}`}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-navy-900 px-5 py-2.5 font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create fee account"}
        </button>
      </form>
    </DashboardLayout>
  );
}
