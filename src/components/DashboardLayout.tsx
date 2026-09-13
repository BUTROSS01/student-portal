import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../config/roles";
import { fetchMyNotifications } from "../api/communication";

interface NavItem {
  label: string;
  href: string;
}

interface DashboardLayoutProps {
  title: string;
  navItems: NavItem[];
  children: ReactNode;
}

export function DashboardLayout({ title, navItems, children }: DashboardLayoutProps) {
  const { user, logout } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchMyNotifications()
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => undefined);
  }, []);

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 flex-col justify-between bg-navy-900 px-5 py-6 text-paper">
        <div>
          <div className="mb-1 h-1 w-8 bg-gold-500" />
          <p className="font-display text-lg leading-tight">Tshwane City College</p>
          <nav className="mt-10 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="block rounded-sm px-3 py-2 text-sm text-paper/80 hover:bg-navy-800 hover:text-paper"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="border-t border-paper/10 pt-4 text-sm">
          <p className="text-paper/90">{user?.email}</p>
          <p className="text-paper/50">{user ? ROLE_LABEL[user.role] : ""}</p>
          <button onClick={() => logout()} className="mt-3 text-gold-400 hover:text-gold-500">
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-10 py-8">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl text-ink">{title}</h1>
          <a href="/notifications" className="relative text-sm text-navy-800 underline decoration-gold-500">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-gold-500 px-1 text-xs font-medium text-navy-900">
                {unreadCount}
              </span>
            )}
          </a>
        </div>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
