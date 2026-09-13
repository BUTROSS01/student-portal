import { apiClient } from "./client";

export interface StudentSummary {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  enrolmentStatus: string;
  programme: { id: string; name: string; code: string } | null;
  campus: { id: string; name: string } | null;
  class: { id: string; name: string } | null;
  user: { email: string; status: string; lastLoginAt: string | null };
}

export interface StudentDetail extends StudentSummary {
  dateOfBirth: string | null;
  idNumber: string | null;
  address: string | null;
  createdAt: string;
  parentLinks: {
    relationship: string;
    isPrimary: boolean;
    parent: { id: string; firstName: string; lastName: string; phone: string | null; user: { email: string } };
  }[];
}

export interface RegisterStudentInput {
  email: string;
  phone?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  idNumber?: string;
  address?: string;
  programmeId?: string;
  campusId?: string;
  classId?: string;
}

export async function fetchMyStudentProfile() {
  const { data } = await apiClient.get<StudentDetail>("/students/me");
  return data;
}

export async function listStudents(params: { search?: string; page?: number; pageSize?: number }) {
  const { data } = await apiClient.get<{ total: number; page: number; pageSize: number; students: StudentSummary[] }>(
    "/students",
    { params }
  );
  return data;
}

export async function registerStudent(input: RegisterStudentInput) {
  const { data } = await apiClient.post<StudentSummary & { temporaryPassword: string }>("/students", input);
  return data;
}
