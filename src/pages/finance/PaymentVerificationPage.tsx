import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listPayments, verifyPayment, rejectPayment, Payment } from "../../api/finance";

const NAV = [
  { label: "Overview", href: "/finance" },
  { label: "Create fee", href: "/finance/create-fee" },
  { label: "Payments awaiting verification", href: "/finance/verification" },
  { label: "Reports", href: "/finance/reports" },
];

export function PaymentVerificationPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rejectionDrafts, setRejectionDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
    listPayments({ status: "SUBMITTED" }).then(setPayments).catch(() => undefined);
  }

  useEffect(refresh, []);

  async function handleVerify(id: string) {
    setError(null);
    try {
      await verifyPayment(id);
      setNotice("Payment confirmed and balance updated.");
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't verify this payment.");
    }
  }

  async function handleReject(id: string) {
    const reason = rejectionDrafts[id]?.trim();
    if (!reason) {
      setError("A reason is required so the student knows what to correct.");
      return;
    }
    setError(null);
    try {
      await rejectPayment(id, reason);
      setNotice("Payment rejected.");
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't reject this payment.");
    }
  }

  return (
    <DashboardLayout title="Payments awaiting verification" navItems={NAV}>
      {notice && <p className="mb-4 border border-confirmed/30 bg-confirmed/5 px-3 py-2 text-sm text-confirmed">{notice}</p>}
      {error && <p className="mb-4 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>}

      <div className="overflow-hidden border border-navy-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
            <tr>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Method / Ref</th>
              <th className="px-4 py-3 font-medium">Proof</th>
              <th className="px-4 py-3 font-medium">Rejection reason</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-navy-700/5 last:border-0">
                <td className="px-4 py-3 text-ink">
                  {p.fee.description}
                  <div className="text-xs text-navy-700">{p.fee.academicYear}</div>
                </td>
                <td className="px-4 py-3 text-navy-700">R{Number(p.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-navy-700">
                  {p.method ?? "—"} {p.referenceNumber ? `· ${p.referenceNumber}` : ""}
                </td>
                <td className="px-4 py-3 text-navy-700">{p.proof ? "Uploaded" : "None"}</td>
                <td className="px-4 py-3">
                  <input
                    value={rejectionDrafts[p.id] ?? ""}
                    onChange={(e) => setRejectionDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Reason for rejection"
                    className="w-full rounded-sm border border-navy-700/30 bg-white px-2 py-1.5 text-xs text-ink"
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleVerify(p.id)}
                      className="rounded-sm bg-confirmed px-3 py-1.5 text-xs font-medium text-paper hover:opacity-90"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleReject(p.id)}
                      className="rounded-sm border border-rejected/40 px-3 py-1.5 text-xs font-medium text-rejected hover:bg-rejected/5"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-navy-700">
                  Nothing awaiting verification.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
