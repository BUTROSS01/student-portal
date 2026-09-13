import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import {
  Campus,
  Department,
  Programme,
  Subject,
  listCampuses,
  createCampus,
  listDepartments,
  createDepartment,
  listProgrammes,
  createProgramme,
  listSubjects,
  createSubject,
} from "../../api/academic";

const NAV = [
  { label: "Overview", href: "/admin" },
  { label: "Users & roles", href: "/admin/users" },
  { label: "Campuses & departments", href: "/admin/structure" },
  { label: "Academic calendar", href: "/admin/calendar" },
  { label: "Audit log", href: "/admin/audit-log" },
  { label: "System settings", href: "/admin/settings" },
];

type FieldDef =
  | { kind: "text"; label: string; required?: boolean }
  | { kind: "number"; label: string; required?: boolean }
  | { kind: "select"; label: string; required?: boolean; options: { value: string; label: string }[] };

export function InstitutionSetupPage() {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listCampuses().then(setCampuses).catch(() => undefined);
    listDepartments().then(setDepartments).catch(() => undefined);
    listProgrammes().then(setProgrammes).catch(() => undefined);
    listSubjects().then(setSubjects).catch(() => undefined);
  }

  useEffect(refresh, []);

  function handleError(err: any) {
    setError(err?.response?.data?.error ?? "Something went wrong. Please try again.");
  }

  async function guarded(fn: () => Promise<unknown>) {
    try {
      await fn();
      setError(null);
      refresh();
    } catch (err) {
      handleError(err);
      throw err;
    }
  }

  return (
    <DashboardLayout title="Institution setup" navItems={NAV}>
      {error && (
        <p role="alert" className="mb-6 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <EntitySection
          title="Campuses"
          items={campuses.map((c) => c.name)}
          fields={[
            { kind: "text", label: "Name", required: true },
            { kind: "text", label: "Address" },
          ]}
          onSubmit={(v) => guarded(() => createCampus({ name: v[0], address: v[1] || undefined }))}
        />

        <EntitySection
          title="Departments"
          items={departments.map((d) => d.name)}
          fields={[{ kind: "text", label: "Name", required: true }]}
          onSubmit={(v) => guarded(() => createDepartment({ name: v[0] }))}
        />

        <EntitySection
          title="Programmes"
          items={programmes.map((p) => `${p.name} (${p.code}) — ${p.department?.name ?? ""}`)}
          fields={[
            { kind: "text", label: "Name", required: true },
            { kind: "text", label: "Code", required: true },
            {
              kind: "select",
              label: "Department",
              required: true,
              options: departments.map((d) => ({ value: d.id, label: d.name })),
            },
            { kind: "number", label: "Duration (years)" },
          ]}
          emptyHint={departments.length === 0 ? "Add a department first." : undefined}
          onSubmit={(v) =>
            guarded(() =>
              createProgramme({ name: v[0], code: v[1], departmentId: v[2], durationYears: Number(v[3] || 1) })
            )
          }
        />

        <EntitySection
          title="Subjects"
          items={subjects.map((s) => `${s.name} (${s.code}) — ${s.programme?.name ?? ""}`)}
          fields={[
            { kind: "text", label: "Name", required: true },
            { kind: "text", label: "Code", required: true },
            {
              kind: "select",
              label: "Programme",
              required: true,
              options: programmes.map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
            },
            { kind: "number", label: "Credits" },
          ]}
          emptyHint={programmes.length === 0 ? "Add a programme first." : undefined}
          onSubmit={(v) =>
            guarded(() => createSubject({ name: v[0], code: v[1], programmeId: v[2], credits: Number(v[3] || 0) }))
          }
        />
      </div>
    </DashboardLayout>
  );
}

function EntitySection({
  title,
  items,
  fields,
  onSubmit,
  emptyHint,
}: {
  title: string;
  items: string[];
  fields: FieldDef[];
  onSubmit: (values: string[]) => Promise<void>;
  emptyHint?: string;
}) {
  const [values, setValues] = useState<string[]>(fields.map(() => ""));
  const [submitting, setSubmitting] = useState(false);

  function setValue(i: number, v: string) {
    setValues((prev) => prev.map((existing, idx) => (idx === i ? v : existing)));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
      setValues(fields.map(() => ""));
    } catch {
      // error already surfaced by the parent
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2 text-sm text-ink focus-visible:border-gold-500";

  return (
    <section className="border border-navy-700/10 bg-white p-5">
      <h2 className="font-display text-lg text-ink">{title}</h2>

      <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm text-navy-700">
        {items.length === 0 && <li className="text-navy-700/60">None yet.</li>}
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="mt-4 space-y-2">
        {fields.map((field, i) =>
          field.kind === "select" ? (
            <select
              key={field.label}
              required={field.required}
              value={values[i]}
              onChange={(e) => setValue(i, e.target.value)}
              className={inputClass}
            >
              <option value="">{field.label}</option>
              {field.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              key={field.label}
              type={field.kind === "number" ? "number" : "text"}
              placeholder={field.label}
              required={field.required}
              value={values[i]}
              onChange={(e) => setValue(i, e.target.value)}
              className={inputClass}
            />
          )
        )}
        {emptyHint && <p className="text-xs text-navy-700">{emptyHint}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-sm bg-navy-900 px-4 py-2 text-sm font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
        >
          Add
        </button>
      </form>
    </section>
  );
}
