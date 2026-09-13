import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  ClassSummary,
  Programme,
  Campus,
  StaffSummary,
  listClasses,
  createClass,
  listProgrammes,
  listCampuses,
  listStaff,
} from "../../api/academic";

const NAV = [
  { label: "Overview", href: "/academic" },
  { label: "Student registration", href: "/academic/registration" },
  { label: "Students", href: "/academic/students" },
  { label: "Classes", href: "/academic/classes" },
  { label: "Results review", href: "/academic/results" },
  { label: "Announcements", href: "/academic/announcements" },
  { label: "Reports", href: "/academic/reports" },
];

const currentYear = new Date().getFullYear().toString();

export function ClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [lecturers, setLecturers] = useState<StaffSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: "",
    programmeId: "",
    campusId: "",
    academicYear: currentYear,
    semester: "1",
    lecturerId: "",
  });

  function refreshClasses() {
    listClasses().then(setClasses).catch(() => undefined);
  }

  useEffect(() => {
    refreshClasses();
    listProgrammes().then(setProgrammes).catch(() => undefined);
    listCampuses().then(setCampuses).catch(() => undefined);
    listStaff("LECTURER").then(setLecturers).catch(() => undefined);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createClass({
        name: form.name,
        programmeId: form.programmeId,
        campusId: form.campusId,
        academicYear: form.academicYear,
        semester: Number(form.semester),
        lecturerId: form.lecturerId || undefined,
      });
      setForm({ name: "", programmeId: "", campusId: "", academicYear: currentYear, semester: "1", lecturerId: "" });
      refreshClasses();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't create the class. Please check the details and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500";

  return (
    <DashboardLayout title="Classes" navItems={NAV}>
      {error && (
        <p role="alert" className="mb-6 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <form onSubmit={handleSubmit} className="space-y-4 border border-navy-700/10 bg-white p-5 lg:col-span-1">
          <h2 className="font-display text-lg text-ink">Create a class</h2>

          <div>
            <label className="block text-sm font-medium text-ink">Class name</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={`mt-1.5 ${inputClass}`}
              placeholder="e.g. IT Year 1 Group A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">Programme</label>
            <select
              required
              value={form.programmeId}
              onChange={(e) => setForm((f) => ({ ...f, programmeId: e.target.value }))}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">Select a programme</option>
              {programmes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">Campus</label>
            <select
              required
              value={form.campusId}
              onChange={(e) => setForm((f) => ({ ...f, campusId: e.target.value }))}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">Select a campus</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-sm font-medium text-ink">Semester</label>
              <select
                value={form.semester}
                onChange={(e) => setForm((f) => ({ ...f, semester: e.target.value }))}
                className={`mt-1.5 ${inputClass}`}
              >
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink">Lecturer</label>
            <select
              value={form.lecturerId}
              onChange={(e) => setForm((f) => ({ ...f, lecturerId: e.target.value }))}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">Not yet assigned</option>
              {lecturers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName} {l.lastName}
                </option>
              ))}
            </select>
            {lecturers.length === 0 && (
              <p className="mt-1 text-xs text-navy-700">
                No lecturer accounts yet — create one from Users &amp; Roles.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-sm bg-navy-900 py-2.5 font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create class"}
          </button>
        </form>

        <div className="overflow-hidden border border-navy-700/10 bg-white lg:col-span-2">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
              <tr>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Programme</th>
                <th className="px-4 py-3 font-medium">Campus</th>
                <th className="px-4 py-3 font-medium">Lecturer</th>
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
                  <td className="px-4 py-3 text-navy-700">
                    {c.lecturer ? `${c.lecturer.firstName} ${c.lecturer.lastName}` : "Unassigned"}
                  </td>
                  <td className="px-4 py-3 text-navy-700">{c._count.students}</td>
                </tr>
              ))}
              {classes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-navy-700">
                    No classes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
