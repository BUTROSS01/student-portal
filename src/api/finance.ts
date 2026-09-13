import { apiClient } from "./client";

export interface Fee {
  id: string;
  academicYear: string;
  description: string;
  amountDue: string;
  amountPaid: string;
  dueDate: string | null;
  status: string;
  createdAt: string;
}

export interface FeeSummaryResponse {
  fees: Fee[];
  totalDue: number;
  totalPaid: number;
  outstanding: number;
}

export interface Payment {
  id: string;
  amount: string;
  method: string | null;
  referenceNumber: string | null;
  status: string;
  submittedAt: string;
  verifiedAt: string | null;
  fee: { id: string; description: string; academicYear: string; studentId: string };
  proof: { documentId: string } | null;
  receipt: { id: string; receiptNumber: string; issuedAt: string } | null;
}

export async function fetchMyFees() {
  const { data } = await apiClient.get<FeeSummaryResponse>("/fees/mine");
  return data;
}

export async function fetchStudentFees(studentId: string) {
  const { data } = await apiClient.get<FeeSummaryResponse>(`/fees/student/${studentId}`);
  return data;
}

export async function listFees(params?: { studentId?: string; status?: string }) {
  const { data } = await apiClient.get<{ fees: Fee[] }>("/fees", { params });
  return data.fees;
}

export async function createFee(input: {
  studentId: string;
  academicYear: string;
  description: string;
  amountDue: number;
  dueDate?: string;
}) {
  const { data } = await apiClient.post<Fee>("/fees", input);
  return data;
}

export async function submitPayment(input: {
  feeId: string;
  amount: number;
  method?: string;
  referenceNumber?: string;
  documentId?: string;
}) {
  const { data } = await apiClient.post<Payment>("/payments", input);
  return data;
}

export async function fetchMyPayments() {
  const { data } = await apiClient.get<{ payments: Payment[] }>("/payments/mine");
  return data.payments;
}

export async function listPayments(params?: { status?: string; feeId?: string }) {
  const { data } = await apiClient.get<{ payments: Payment[] }>("/payments", { params });
  return data.payments;
}

export async function verifyPayment(id: string) {
  const { data } = await apiClient.post<Payment>(`/payments/${id}/verify`);
  return data;
}

export async function rejectPayment(id: string, reason: string) {
  const { data } = await apiClient.post<Payment>(`/payments/${id}/reject`, { reason });
  return data;
}
