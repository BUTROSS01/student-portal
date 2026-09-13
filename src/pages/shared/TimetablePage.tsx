import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { fetchMyTimetable, TimetableEntry } from "../../api/reporting";

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface Props {
  navItems: { label: string; href: string }[];
}

export function TimetablePage({ navItems }: Props) {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);

  useEffect(() => {
    fetchMyTimetable().then(setEntries).catch(() => undefined);
  }, []);

  return (
    <DashboardLayout title="Timetable" navItems={navItems}>
      <div className="overflow-hidden border border-navy-700/10 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700/10 bg-navy-900/[0.02] text-navy-700">
            <tr>
              <th className="px-4 py-3 font-medium">Day</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Room</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-navy-700/5 last:border-0">
                <td className="px-4 py-3 text-ink">{e.dayOfWeek ? DAY_NAMES[e.dayOfWeek] : "—"}</td>
                <td className="px-4 py-3 text-navy-700">
                  {e.startTime} – {e.endTime}
                </td>
                <td className="px-4 py-3 text-navy-700">{e.class?.name ?? e.examination?.name ?? "—"}</td>
                <td className="px-4 py-3 text-navy-700">{e.room ?? "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-navy-700">
                  No timetable entries yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
