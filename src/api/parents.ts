import { apiClient } from "./client";

export interface LinkedStudent {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  enrolmentStatus: string;
  programme: { name: string; code: string } | null;
  campus: { name: string } | null;
  relationship: string;
  isPrimary: boolean;
}

export async function fetchMyLinkedStudents() {
  const { data } = await apiClient.get<{
    parent: { id: string; firstName: string; lastName: string };
    students: LinkedStudent[];
  }>("/parents/me/students");
  return data;
}
