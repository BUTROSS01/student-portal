import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { registerStudent } from "../../api/students";
import { listCampuses, listProgrammes, Campus, Programme } from "../../api/academic";

const NAV = [
  { label: "Overview", href: "/academic" },
  { label: "Student registration", href: "/academic/registration" },
  { label: "Students", href: "/academic/students" },
  { label: "Classes", href: "/academic/classes" },
  { label: "Results review", href: "/academic/results" },
  { label: "Announcements", href: "/academic/announcements" },
  { label: "Reports", href: "/academic/reports" },
];

const initialForm = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  dateOfBirth: "",
  idNumber: "",
  address: "",
  programmeId: "",
  campusId: "",
};

export function StudentRegistrationPage() {
  const [form, setForm] = useState(initialForm);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ studentNumber: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    listCampuses().then(setCampuses).catch(() => undefined);
    listProgrammes().then(setProgrammes).catch(() => undefined);
  }, []);

  function update<K extends keyof typeof initialForm>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setResult(null);

    try {
      const student = await registerStudent({
        email: form.email,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        idNumber: form.idNumber || undefined,
        address: form.address || undefined,
        programmeId: form.programmeId || undefined,
        campusId: form.campusId || undefined,
      });
      setResult({ studentNumber: student.studentNumber, temporaryPassword: student.temporaryPassword });
      setForm(initialForm);
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Registration failed. Please check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout title="Register a new student" navItems={NAV}>
      {result && (
        <div className="mb-6 border border-confirmed/30 bg-confirmed/5 px-5 py-4">
          <p className="font-medium text-confirmed">
            Student {result.studentNumber} registered successfully.
          </p>
          <p className="mt-1 text-sm text-navy-700">
            Temporary password (hand this to the student/parent out of band —
            it will not be shown again):{" "}
            <span className="font-mono font-medium text-ink">{result.temporaryPassword}</span>
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mb-6 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="max-w-xl space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" required value={form.firstName} onChange={(v) => update("firstName", v)} />
          <Field label="Last name" required value={form.lastName} onChange={(v) => update("lastName", v)} />
        </div>

        <Field
          label="Email address"
          type="email"
          required
          value={form.email}
          onChange={(v) => update("email", v)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Phone" value={form.phone} onChange={(v) => update("phone", v)} />
          <Field
            label="Date of birth"
            type="date"
            value={form.dateOfBirth}
            onChange={(v) => update("dateOfBirth", v)}
          />
        </div>

        <Field label="ID number" value={form.idNumber} onChange={(v) => update("idNumber", v)} />
        <Field label="Address" value={form.address} onChange={(v) => update("address", v)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-ink">Programme</label>
            <select
              value={form.programmeId}
              onChange={(e) => update("programmeId", e.target.value)}
              className="mt-1.5 w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500"
            >
              <option value="">Not yet allocated</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            {programmes.length === 0 && (
              <p className="mt-1 text-xs text-navy-700">
                No programmes configured yet — add one under Institution Setup.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">Campus</label>
            <select
              value={form.campusId}
              onChange={(e) => update("campusId", e.target.value)}
              className="mt-1.5 w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500"
            >
              <option value="">Not yet allocated</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {campuses.length === 0 && (
              <p className="mt-1 text-xs text-navy-700">
                No campuses configured yet — add one under Institution Setup.
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-navy-900 px-5 py-2.5 font-medium text-paper transition-colors hover:bg-navy-800 disabled:opacity-60"
        >
          {submitting ? "Registering…" : "Register student"}
        </button>
      </form>
    </DashboardLayout>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500"
      />
    </div>
  );
}
