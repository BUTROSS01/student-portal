import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";

const NAV = [
  { label: "Overview", href: "/admin" },
  { label: "Users & roles", href: "/admin/users" },
  { label: "Campuses & departments", href: "/admin/structure" },
  { label: "Academic calendar", href: "/admin/calendar" },
  { label: "Audit log", href: "/admin/audit-log" },
  { label: "System settings", href: "/admin/settings" },
];

export function AdminDashboard() {
  return (
    <DashboardLayout title="System administration" navItems={NAV}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value="—" />
        <StatCard label="Accounts pending activation" value="—" accent="gold" />
        <StatCard label="Failed logins (24h)" value="—" accent="rejected" />
        <StatCard label="Active sessions" value="—" accent="confirmed" />
      </div>
      <p className="mt-8 text-sm text-navy-700">
        User creation, role assignment, and account status changes are live
        against the Module 1 API (<code>/api/users</code>) — the "Users &amp;
        roles" screen is the next piece of UI to wire up.
      </p>
    </DashboardLayout>
  );
}
