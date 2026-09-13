import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { listAnnouncements, createAnnouncement, Announcement } from "../../api/communication";

const CAN_POST: Record<string, string[]> = {
  SUPER_ADMIN: ["STUDENT", "PARENT", "CLASS", "PROGRAMME", "DEPARTMENT", "CAMPUS", "COLLEGE_WIDE"],
  MANAGEMENT: ["STUDENT", "PARENT", "CLASS", "PROGRAMME", "DEPARTMENT", "CAMPUS", "COLLEGE_WIDE"],
  ACADEMIC_ADMIN: ["STUDENT", "PARENT", "CLASS", "PROGRAMME"],
  LECTURER: ["CLASS"],
};

interface Props {
  navItems: { label: string; href: string }[];
}

export function AnnouncementsPage({ navItems }: Props) {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("COLLEGE_WIDE");
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const allowedAudiences = user ? CAN_POST[user.role] ?? [] : [];
  const canPost = allowedAudiences.length > 0;

  function refresh() {
    listAnnouncements().then(setAnnouncements).catch(() => undefined);
  }

  useEffect(refresh, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const result = await createAnnouncement({
        title,
        body,
        audience,
        targetId: audience === "COLLEGE_WIDE" ? undefined : targetId,
      });
      setNotice(`Published — reached ${result.reach} student${result.reach === 1 ? "" : "s"} (and their linked parents).`);
      setTitle("");
      setBody("");
      setTargetId("");
      refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Couldn't publish this announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500";

  return (
    <DashboardLayout title="Announcements" navItems={navItems}>
      {canPost && (
        <div className="mb-8 border border-navy-700/10 bg-white p-5">
          <h2 className="font-display text-lg text-ink">Publish an announcement</h2>
          {notice && <p className="mt-3 border border-confirmed/30 bg-confirmed/5 px-3 py-2 text-sm text-confirmed">{notice}</p>}
          {error && <p className="mt-3 border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">{error}</p>}
          <form onSubmit={handleSubmit} className="mt-4 max-w-xl space-y-4">
            <input required placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            <textarea
              required
              placeholder="Message"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-4">
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputClass}>
                {allowedAudiences.map((a) => (
                  <option key={a} value={a}>
                    {a.replace("_", " ")}
                  </option>
                ))}
              </select>
              {audience !== "COLLEGE_WIDE" && (
                <input
                  required
                  placeholder={`${audience} ID`}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className={inputClass}
                />
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-sm bg-navy-900 px-5 py-2.5 font-medium text-paper hover:bg-navy-800 disabled:opacity-60"
            >
              {submitting ? "Publishing…" : "Publish"}
            </button>
          </form>
        </div>
      )}

      <h2 className="font-display text-lg text-ink">Recent announcements</h2>
      <div className="mt-3 space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="border border-navy-700/10 border-l-2 border-l-gold-500 bg-white px-5 py-4">
            <div className="flex items-baseline justify-between">
              <p className="font-medium text-ink">{a.title}</p>
              <span className="text-xs text-navy-700">{new Date(a.publishedAt).toLocaleDateString()}</span>
            </div>
            <p className="mt-1 text-sm text-navy-700">{a.body}</p>
          </div>
        ))}
        {announcements.length === 0 && <p className="text-sm text-navy-700">No announcements yet.</p>}
      </div>
    </DashboardLayout>
  );
}
