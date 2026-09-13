import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { listDocuments, uploadDocument, downloadDocument, DocumentSummary } from "../../api/documents";

const NAV = [
  { label: "Overview", href: "/student" },
  { label: "Results", href: "/student/results" },
  { label: "Fees & Payments", href: "/student/fees" },
  { label: "Attendance", href: "/student/attendance" },
  { label: "Timetable", href: "/student/timetable" },
  { label: "Documents", href: "/student/documents" },
  { label: "Announcements", href: "/student/announcements" },
];

export function StudentDocumentsPage() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("OTHER");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    listDocuments().then(setDocuments).catch(() => undefined);
  }

  useEffect(refresh, []);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setSubmitting(true);
    try {
      await uploadDocument(file, type);
      setFile(null);
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't upload this file.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardLayout title="Documents" navItems={NAV}>
      {error && <p className="mb-4 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>}

      <form onSubmit={handleUpload} className="flex flex-wrap items-end gap-3 border border-navy-700/10 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-ink">Document type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 rounded-sm border border-navy-700/30 bg-white px-2 py-1.5 text-sm">
            <option value="OTHER">Other</option>
            <option value="ID_DOCUMENT">ID document</option>
            <option value="CORRESPONDENCE">Correspondence</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink">File</label>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 text-sm" />
        </div>
        <button
          type="submit"
          disabled={!file || submitting}
          className="rounded-sm bg-navy-900 px-4 py-2 text-sm font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
        >
          {submitting ? "Uploading…" : "Upload"}
        </button>
      </form>

      <div className="mt-6 overflow-hidden border border-navy-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
            <tr>
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Uploaded</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id} className="border-b border-navy-700/5 last:border-0">
                <td className="px-4 py-3 text-ink">{d.fileName}</td>
                <td className="px-4 py-3 text-navy-700">{d.type}</td>
                <td className="px-4 py-3 text-navy-700">{new Date(d.uploadedAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => downloadDocument(d.id, d.fileName)}
                    className="text-xs text-navy-800 underline decoration-gold-500"
                  >
                    Download
                  </button>
                </td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-navy-700">
                  No documents yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
