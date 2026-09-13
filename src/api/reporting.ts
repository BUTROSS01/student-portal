import { apiClient } from "./client";

export interface TimetableEntry {
  id: string;
  dayOfWeek: number | null;
  startTime: string;
  endTime: string;
  room: string | null;
  class: { id: string; name: string; programme: { name: string } } | null;
  examination: { id: string; name: string; examDate: string | null } | null;
}

export async function fetchMyTimetable() {
  const { data } = await apiClient.get<{ entries: TimetableEntry[] }>("/timetables/mine");
  return data.entries;
}

export async function createTimetableEntry(input: {
  classId?: string;
  examinationId?: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  room?: string;
}) {
  const { data } = await apiClient.post<TimetableEntry>("/timetables", input);
  return data;
}

export type ReportName = "student-register" | "fee-collection" | "academic-performance" | "attendance";

export async function fetchReport(name: ReportName) {
  const { data } = await apiClient.get<{ rows: Record<string, unknown>[]; [key: string]: unknown }>(`/reports/${name}`);
  return data;
}

export async function downloadReportCsv(name: ReportName) {
  const response = await apiClient.get(`/reports/${name}`, { params: { format: "csv" }, responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
  user: { email: string; role: { name: string } } | null;
}

export async function listAuditLogs(params?: { action?: string; entityType?: string; page?: number }) {
  const { data } = await apiClient.get<{ total: number; logs: AuditLogEntry[] }>("/audit-logs", { params });
  return data;
}

export async function fetchSystemSettings() {
  const { data } = await apiClient.get("/admin/settings");
  return data as {
    passwordMinLength: number;
    maxFailedLoginAttempts: number;
    lockoutMinutes: number;
    attendanceAlertThreshold: number;
    maxUploadSizeMb: number;
  };
}
