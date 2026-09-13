import { useEffect, useState } from "react";
import { DashboardLayout } from "../../components/DashboardLayout";
import { fetchMyNotifications, markNotificationRead, Notification } from "../../api/communication";

interface Props {
  navItems: { label: string; href: string }[];
}

export function NotificationsPage({ navItems }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  function refresh() {
    fetchMyNotifications().then((res) => setNotifications(res.notifications));
  }

  useEffect(refresh, []);

  async function handleRead(id: string) {
    await markNotificationRead(id);
    refresh();
  }

  return (
    <DashboardLayout title="Notifications" navItems={navItems}>
      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`border border-navy-700/10 bg-white px-5 py-4 ${n.readAt ? "" : "border-l-2 border-l-gold-500"}`}
          >
            <div className="flex items-baseline justify-between">
              <p className="font-medium text-ink">{n.title}</p>
              <span className="text-xs text-navy-700">{new Date(n.sentAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-sm text-navy-700">{n.body}</p>
            {!n.readAt && (
              <button onClick={() => handleRead(n.id)} className="mt-2 text-xs text-navy-800 underline decoration-gold-500">
                Mark as read
              </button>
            )}
          </div>
        ))}
        {notifications.length === 0 && <p className="text-sm text-navy-700">No notifications yet.</p>}
      </div>
    </DashboardLayout>
  );
}
