import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listResults, approveResult, rejectResult, publishResults, ResultSummary } from "../../api/results";

const NAV = [
  { label: "Overview", href: "/academic" },
  { label: "Student registration", href: "/academic/registration" },
  { label: "Students", href: "/academic/students" },
  { label: "Classes", href: "/academic/classes" },
  { label: "Results review", href: "/academic/results" },
  { label: "Announcements", href: "/academic/announcements" },
  { label: "Reports", href: "/academic/reports" },
];

export function ResultsReviewPage() {
  const [submitted, setSubmitted] = useState<ResultSummary[]>([]);
  const [approved, setApproved] = useState<ResultSummary[]>([]);
  const [rejectionDrafts, setRejectionDrafts] = useState<Record<string, string>>({});
  const [selectedToPublish, setSelectedToPublish] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function refresh() {
    listResults({ status: "SUBMITTED" }).then((res) => setSubmitted(res.results)).catch(() => undefined);
    listResults({ status: "APPROVED" }).then((res) => setApproved(res.results)).catch(() => undefined);
  }

  useEffect(refresh, []);

  async function handleApprove(id: string) {
    setError(null);
    try {
      await approveResult(id);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't approve this result.");
    }
  }

  async function handleReject(id: string) {
    const reason = rejectionDrafts[id]?.trim();
    if (!reason) {
      setError("A reason is required so the lecturer knows what to correct.");
      return;
    }
    setError(null);
    try {
      await rejectResult(id, reason);
      setRejectionDrafts((prev) => ({ ...prev, [id]: "" }));
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't reject this result.");
    }
  }

  function toggleSelected(id: string) {
    setSelectedToPublish((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handlePublish() {
    if (selectedToPublish.size === 0) return;
    setError(null);
    setNotice(null);
    try {
      const res = await publishResults(Array.from(selectedToPublish));
      setNotice(`Published ${res.published.length} result${res.published.length === 1 ? "" : "s"}.`);
      setSelectedToPublish(new Set());
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't publish the selected results.");
    }
  }

  return (
    <DashboardLayout title="Results review" navItems={NAV}>
      {error && (
        <p role="alert" className="mb-4 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
          {error}
        </p>
      )}
      {notice && (
        <p className="mb-4 border border-confirmed/30 bg-confirmed/5 px-3 py-2 text-sm text-confirmed">{notice}</p>
      )}

      <section>
        <h2 className="font-display text-lg text-ink">Awaiting review</h2>
        <div className="mt-3 overflow-hidden border border-navy-700/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Mark</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Rejection reason (if rejecting)</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {submitted.map((r) => (
                <tr key={r.id} className="border-b border-navy-700/5 last:border-0">
                  <td className="px-4 py-3 text-ink">
                    {r.student.firstName} {r.student.lastName}
                    <div className="text-xs text-navy-700">{r.student.studentNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-navy-700">{r.subject.name}</td>
                  <td className="px-4 py-3 text-navy-700">
                    {r.marksObtained} / {r.maxMarks} ({r.percentage}%)
                  </td>
                  <td className="px-4 py-3 text-navy-700">{r.grade}</td>
                  <td className="px-4 py-3">
                    <input
                      value={rejectionDrafts[r.id] ?? ""}
                      onChange={(e) => setRejectionDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="Reason for rejection"
                      className="w-full rounded-sm border border-navy-700/30 bg-white px-2 py-1.5 text-xs text-ink"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(r.id)}
                        className="rounded-sm bg-confirmed px-3 py-1.5 text-xs font-medium text-paper hover:opacity-90"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReject(r.id)}
                        className="rounded-sm border border-rejected/40 px-3 py-1.5 text-xs font-medium text-rejected hover:bg-rejected/5"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {submitted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-navy-700">
                    Nothing awaiting review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Approved — ready to publish</h2>
          <button
            onClick={handlePublish}
            disabled={selectedToPublish.size === 0}
            className="rounded-sm bg-navy-900 px-4 py-2 text-sm font-medium text-paper hover:bg-navy-800 disabled:opacity-40"
          >
            Publish selected ({selectedToPublish.size})
          </button>
        </div>
        <div className="mt-3 overflow-hidden border border-navy-700/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Mark</th>
                <th className="px-4 py-3 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {approved.map((r) => (
                <tr key={r.id} className="border-b border-navy-700/5 last:border-0">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedToPublish.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                    />
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {r.student.firstName} {r.student.lastName}
                    <div className="text-xs text-navy-700">{r.student.studentNumber}</div>
                  </td>
                  <td className="px-4 py-3 text-navy-700">{r.subject.name}</td>
                  <td className="px-4 py-3 text-navy-700">
                    {r.marksObtained} / {r.maxMarks} ({r.percentage}%)
                  </td>
                  <td className="px-4 py-3 text-navy-700">{r.grade}</td>
                </tr>
              ))}
              {approved.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-navy-700">
                    Nothing approved yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardLayout>
  );
}
