import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { fetchMyFees, submitPayment, fetchMyPayments, Fee, Payment } from "../../api/finance";
import { uploadDocument } from "../../api/documents";

const NAV = [
  { label: "Overview", href: "/student" },
  { label: "Results", href: "/student/results" },
  { label: "Fees & Payments", href: "/student/fees" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Timetable", href: "/student/timetable" },
  { label: "Documents", href: "/student/documents" },
  { label: "Announcements", href: "/student/announcements" },
];

export function StudentFeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [totals, setTotals] = useState({ totalDue: 0, totalPaid: 0, outstanding: 0 });
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFT");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
    fetchMyFees().then((res) => {
      setFees(res.fees);
      setTotals({ totalDue: res.totalDue, totalPaid: res.totalPaid, outstanding: res.outstanding });
    });
    fetchMyPayments().then(setPayments);
  }

  useEffect(refresh, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      let documentId: string | undefined;
      if (proofFile) {
        const doc = await uploadDocument(proofFile, "PROOF_OF_PAYMENT");
        documentId = doc.id;
      }

      await submitPayment({
        feeId: selectedFeeId,
        amount: Number(amount),
        method,
        referenceNumber: referenceNumber || undefined,
        documentId,
      });

      setNotice("Payment submitted. Finance will verify it and your balance will update once confirmed.");
      setAmount("");
      setReferenceNumber("");
      setProofFile(null);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't submit this payment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500";

  return (
    <DashboardLayout title="Fees & payments" navItems={NAV}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total due" value={`R${totals.totalDue.toFixed(2)}`} />
        <StatCard label="Total paid" value={`R${totals.totalPaid.toFixed(2)}`} accent="confirmed" />
        <StatCard label="Outstanding" value={`R${totals.outstanding.toFixed(2)}`} accent={totals.outstanding > 0 ? "gold" : "confirmed"} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-lg text-ink">Fee accounts</h2>
          <div className="mt-3 overflow-hidden border border-navy-700/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 font-medium">Due</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id} className="border-b border-navy-700/5 last:border-0">
                    <td className="px-4 py-3 text-ink">
                      {f.description}
                      <div className="text-xs text-navy-700">{f.academicYear}</div>
                    </td>
                    <td className="px-4 py-3 text-navy-700">R{Number(f.amountDue).toFixed(2)}</td>
                    <td className="px-4 py-3 text-navy-700">R{Number(f.amountPaid).toFixed(2)}</td>
                    <td className="px-4 py-3 text-navy-700">{f.status}</td>
                  </tr>
                ))}
                {fees.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-navy-700">
                      No fee accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 font-display text-lg text-ink">Payment history</h2>
          <div className="mt-3 overflow-hidden border border-navy-700/10 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-navy-700/5 last:border-0">
                    <td className="px-4 py-3 text-ink">R{Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-navy-700">{p.status}</td>
                    <td className="px-4 py-3 text-navy-700">{p.receipt?.receiptNumber ?? "—"}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-navy-700">
                      No payments submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-ink">Submit a payment</h2>
          {notice && <p className="mt-3 border border-confirmed/30 bg-confirmed/5 px-3 py-2 text-sm text-confirmed">{notice}</p>}
          {error && <p className="mt-3 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>}

          <form onSubmit={handleSubmit} className="mt-3 space-y-4 border border-navy-700/10 bg-white p-5">
            <div>
              <label className="block text-sm font-medium text-ink">Fee account</label>
              <select required value={selectedFeeId} onChange={(e) => setSelectedFeeId(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                <option value="">Select a fee</option>
                {fees.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.description} — outstanding R{(Number(f.amountDue) - Number(f.amountPaid)).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">Amount (R)</label>
              <input required type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">Payment method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={`mt-1.5 ${inputClass}`}>
                <option value="EFT">EFT</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">Reference number</label>
              <input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} className={`mt-1.5 ${inputClass}`} />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink">Proof of payment (optional)</label>
              <input
                type="file"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-1.5 w-full text-sm text-navy-700"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm bg-navy-900 py-2.5 font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit payment"}
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
