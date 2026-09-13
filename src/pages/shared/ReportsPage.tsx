import { useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { fetchReport, downloadReportCsv, ReportName } from "../../api/reporting";

interface Props {
  navItems: { label: string; href: string }[];
}

const REPORTS: { name: ReportName; label: string; roles: string[] }[] = [
  { name: "student-register", label: "Student register", roles: ["SUPER_ADMIN", "ACADEMIC_ADMIN", "MANAGEMENT"] },
  { name: "fee-collection", label: "Fee collection", roles: ["FINANCE", "SUPER_ADMIN", "MANAGEMENT"] },
  { name: "academic-performance", label: "Academic performance", roles: ["ACADEMIC_ADMIN", "SUPER_ADMIN", "MANAGEMENT"] },
  { name: "attendance", label: "Attendance", roles: ["ACADEMIC_ADMIN", "SUPER_ADMIN", "MANAGEMENT"] },
];

export function ReportsPage({ navItems }: Props) {
  const { user } = useAuth();
  const [activeReport, setActiveReport] = useState<ReportName | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const available = REPORTS.filter((r) => user && r.roles.includes(user.role));

  async function handleView(name: ReportName) {
    setActiveReport(name);
    setLoading(true);
    try {
      const res = await fetchReport(name);
      setRows(res.rows);
    } finally {
      setLoading(false);
    }
  }

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <DashboardLayout title="Reports" navItems={navItems}>
      <div className="flex flex-wrap gap-3">
        {available.map((r) => (
          <div key={r.name} className="border border-navy-700/10 bg-white px-4 py-3">
            <p className="font-medium text-ink">{r.label}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleView(r.name)}
                className="rounded-sm bg-navy-900 px-3 py-1.5 text-xs font-medium text-paper hover:bg-navy-800"
              >
                View
              </button>
              <button
                onClick={() => downloadReportCsv(r.name)}
                className="rounded-sm border border-navy-700/30 px-3 py-1.5 text-xs font-medium text-ink hover:bg-navy-700/5"
              >
                Download CSV
              </button>
            </div>
          </div>
        ))}
      </div>

      {activeReport && (
        <div className="mt-8 overflow-x-auto border border-navy-700/10 bg-white">
          {loading ? (
            <p className="px-4 py-6 text-sm text-navy-700">Loading…</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="whitespace-nowrap px-4 py-3 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-navy-700/5 last:border-0">
                    {columns.map((c) => (
                      <td key={c} className="whitespace-nowrap px-4 py-3 text-navy-700">
                        {String(row[c] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-center text-navy-700">No data.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
