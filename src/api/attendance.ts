import { apiClient } from "./client";

export interface AttendanceStats {
  percentage: number;
  absences: number;
  lates: number;
  totalRecorded: number;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  comment: string | null;
  class?: { name: string };
}

export async function fetchMyAttendance() {
  const { data } = await apiClient.get<{ records: AttendanceRecord[]; stats: AttendanceStats }>("/attendance/mine");
  return data;
}

export async function fetchStudentAttendance(studentId: string) {
  const { data } = await apiClient.get<{ records: AttendanceRecord[]; stats: AttendanceStats }>(
    `/attendance/student/${studentId}`
  );
  return data;
}

export async function listClassAttendance(classId: string, date?: string) {
  const { data } = await apiClient.get<{
    records: { id: string; date: string; status: string; comment: string | null; student: { id: string; studentNumber: string; firstName: string; lastName: string } }[];
  }>("/attendance", { params: { classId, date } });
  return data.records;
}

export async function recordAttendance(input: {
  classId: string;
  date: string;
  records: { studentId: string; status: string; comment?: string }[];
}) {
  const { data } = await apiClient.post("/attendance", input);
  return data;
}
