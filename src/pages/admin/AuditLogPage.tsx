import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listAuditLogs, AuditLogEntry } from "../../api/reporting";

const NAV = [
  { label: "Overview", href: "/admin" },
  { label: "Users & roles", href: "/admin/users" },
  { label: "Campuses & departments", href: "/admin/structure" },
  { label: "Audit log", href: "/admin/audit-log" },
  { label: "System settings", href: "/admin/settings" },
];

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    listAuditLogs({ action: actionFilter || undefined }).then((res) => {
      setLogs(res.logs);
      setTotal(res.total);
    });
  }, [actionFilter]);

  return (
    <DashboardLayout title="Audit log" navItems={NAV}>
      <input
        placeholder="Filter by action (e.g. PAYMENT_VERIFIED)"
        value={actionFilter}
        onChange={(e) => setActionFilter(e.target.value)}
        className="w-full max-w-sm rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500"
      />

      <p className="mt-2 text-xs text-navy-700">{total} total entries</p>

      <div className="mt-4 overflow-hidden border border-navy-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
            <tr>
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-navy-700/5 last:border-0">
                <td className="px-4 py-3 text-navy-700">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-navy-700">{log.user?.email ?? "System"}</td>
                <td className="px-4 py-3 text-ink">{log.action}</td>
                <td className="px-4 py-3 text-navy-700">{log.entityType ?? "—"}</td>
                <td className="px-4 py-3 text-navy-700">{log.ipAddress ?? "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-navy-700">
                  No matching audit log entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
