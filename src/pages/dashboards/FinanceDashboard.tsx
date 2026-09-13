import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { listPayments } from "../../api/finance";
import { fetchReport } from "../../api/reporting";

const NAV = [
  { label: "Overview", href: "/finance" },
  { label: "Create fee", href: "/finance/create-fee" },
  { label: "Payments awaiting verification", href: "/finance/verification" },
  { label: "Reports", href: "/finance/reports" },
];

export function FinanceDashboard() {
  const [awaitingVerification, setAwaitingVerification] = useState<number | null>(null);
  const [totals, setTotals] = useState<{ totalOutstanding: number; totalPaid: number } | null>(null);

  useEffect(() => {
    listPayments({ status: "SUBMITTED" }).then((p) => setAwaitingVerification(p.length)).catch(() => undefined);
    fetchReport("fee-collection")
      .then((res) => {
        const t = res.totals as { totalOutstanding: number; totalPaid: number } | undefined;
        if (t) setTotals(t);
      })
      .catch(() => undefined);
  }, []);

  return (
    <DashboardLayout title="Finance overview" navItems={NAV}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total collected" value={totals ? `R${totals.totalPaid.toFixed(2)}` : "—"} accent="confirmed" />
        <StatCard label="Outstanding fees" value={totals ? `R${totals.totalOutstanding.toFixed(2)}` : "—"} accent="gold" />
        <StatCard
          label="Awaiting verification"
          value={awaitingVerification === null ? "—" : String(awaitingVerification)}
          accent="gold"
        />
      </div>
    </DashboardLayout>
  );
}
