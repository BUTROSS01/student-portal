interface StatCardProps {
  label: string;
  value: string;
  accent?: "gold" | "confirmed" | "rejected";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  gold: "border-b-gold-500",
  confirmed: "border-b-confirmed",
  rejected: "border-b-rejected",
};

export function StatCard({ label, value, accent = "gold" }: StatCardProps) {
  return (
    <div className={`border border-navy-700/10 border-b-2 bg-white px-5 py-4 ${ACCENT_CLASSES[accent]}`}>
      <p className="text-sm text-navy-700">{label}</p>
      <p className="mt-1 font-display text-2xl text-ink">{value}</p>
    </div>
  );
}
