import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { StatCard } from "../../components/StatCard";
import { listStudents } from "../../api/students";
import { listResults } from "../../api/results";

const NAV = [
  { label: "Overview", href: "/academic" },
  { label: "Student registration", href: "/academic/registration" },
  { label: "Students", href: "/academic/students" },
  { label: "Classes", href: "/academic/classes" },
  { label: "Results review", href: "/academic/results" },
  { label: "Announcements", href: "/academic/announcements" },
  { label: "Reports", href: "/academic/reports" },
];

export function AcademicDashboard() {
  const [totalStudents, setTotalStudents] = useState<number | null>(null);
  const [awaitingReview, setAwaitingReview] = useState<number | null>(null);
  const [readyToPublish, setReadyToPublish] = useState<number | null>(null);

  useEffect(() => {
    listStudents({ page: 1, pageSize: 1 })
      .then((res) => setTotalStudents(res.total))
      .catch(() => setTotalStudents(null));
    listResults({ status: "SUBMITTED" })
      .then((res) => setAwaitingReview(res.total))
      .catch(() => setAwaitingReview(null));
    listResults({ status: "APPROVED" })
      .then((res) => setReadyToPublish(res.total))
      .catch(() => setReadyToPublish(null));
  }, []);

  return (
    <DashboardLayout title="Academic administration" navItems={NAV}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total students" value={totalStudents === null ? "—" : String(totalStudents)} />
        <StatCard
          label="Results awaiting review"
          value={awaitingReview === null ? "—" : String(awaitingReview)}
          accent="gold"
        />
        <StatCard
          label="Approved — ready to publish"
          value={readyToPublish === null ? "—" : String(readyToPublish)}
          accent="confirmed"
        />
      </div>
    </DashboardLayout>
  );
}
