import { apiClient } from "./client";

export type ResultStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "PUBLISHED" | "REJECTED";

export interface ResultSummary {
  id: string;
  marksObtained: string;
  maxMarks: string;
  percentage: string;
  grade: string | null;
  passed: boolean | null;
  status: ResultStatus;
  publishedAt: string | null;
  createdAt: string;
  student: { id: string; studentNumber: string; firstName: string; lastName: string };
  subject: { id: string; name: string; code: string; credits: number };
  examination: { id: string; name: string } | null;
}

export interface Transcript {
  student: { id: string; studentNumber: string; name: string; programme: { name: string; code: string } | null };
  results: ResultSummary[];
  overallAverage: number | null;
  subjectsPassed: number;
  subjectsFailed: number;
}

export async function enterResult(input: {
  studentId: string;
  subjectId: string;
  examinationId?: string;
  marksObtained: number;
  maxMarks?: number;
}) {
  const { data } = await apiClient.post<ResultSummary>("/results", input);
  return data;
}

export async function updateResult(id: string, input: { marksObtained: number; maxMarks?: number; reason: string }) {
  const { data } = await apiClient.patch<ResultSummary>(`/results/${id}`, input);
  return data;
}

export async function submitResult(id: string) {
  const { data } = await apiClient.post<ResultSummary>(`/results/${id}/submit`);
  return data;
}

export async function approveResult(id: string) {
  const { data } = await apiClient.post<ResultSummary>(`/results/${id}/approve`);
  return data;
}

export async function rejectResult(id: string, reason: string) {
  const { data } = await apiClient.post<ResultSummary>(`/results/${id}/reject`, { reason });
  return data;
}

export async function publishResults(resultIds: string[]) {
  const { data } = await apiClient.post<{ published: string[]; skipped: string[] }>("/results/publish", { resultIds });
  return data;
}

export async function listResults(params?: { studentId?: string; subjectId?: string; status?: ResultStatus }) {
  const { data } = await apiClient.get<{ total: number; results: ResultSummary[] }>("/results", { params });
  return data;
}

export async function fetchMyResults() {
  const { data } = await apiClient.get<{ results: ResultSummary[] }>("/results/mine");
  return data.results;
}

export async function fetchTranscript(studentId: string) {
  const { data } = await apiClient.get<Transcript>(`/results/transcript/${studentId}`);
  return data;
}
