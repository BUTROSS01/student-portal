import { apiClient } from "./client";

export interface Campus {
  id: string;
  name: string;
  address: string | null;
}

export interface Department {
  id: string;
  name: string;
}

export interface Programme {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  durationYears: number;
  department?: { id: string; name: string };
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  programmeId: string;
  credits: number;
  programme?: { id: string; name: string; code: string };
}

export interface ClassSummary {
  id: string;
  name: string;
  academicYear: string;
  semester: number;
  programme: { id: string; name: string; code: string };
  campus: { id: string; name: string };
  lecturer: { id: string; firstName: string; lastName: string } | null;
  _count: { students: number };
}

export interface StaffSummary {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobTitle: string | null;
  department: { id: string; name: string } | null;
  user: { email: string; role: { name: string } };
}

export async function listCampuses() {
  const { data } = await apiClient.get<{ campuses: Campus[] }>("/campuses");
  return data.campuses;
}

export async function createCampus(input: { name: string; address?: string }) {
  const { data } = await apiClient.post<Campus>("/campuses", input);
  return data;
}

export async function listDepartments() {
  const { data } = await apiClient.get<{ departments: Department[] }>("/departments");
  return data.departments;
}

export async function createDepartment(input: { name: string }) {
  const { data } = await apiClient.post<Department>("/departments", input);
  return data;
}

export async function listProgrammes(departmentId?: string) {
  const { data } = await apiClient.get<{ programmes: Programme[] }>("/programmes", {
    params: departmentId ? { departmentId } : undefined,
  });
  return data.programmes;
}

export async function createProgramme(input: {
  name: string;
  code: string;
  departmentId: string;
  durationYears?: number;
}) {
  const { data } = await apiClient.post<Programme>("/programmes", input);
  return data;
}

export async function listSubjects(programmeId?: string) {
  const { data } = await apiClient.get<{ subjects: Subject[] }>("/subjects", {
    params: programmeId ? { programmeId } : undefined,
  });
  return data.subjects;
}

export async function createSubject(input: { name: string; code: string; programmeId: string; credits?: number }) {
  const { data } = await apiClient.post<Subject>("/subjects", input);
  return data;
}

export async function listClasses(params?: { programmeId?: string; campusId?: string; academicYear?: string }) {
  const { data } = await apiClient.get<{ classes: ClassSummary[] }>("/classes", { params });
  return data.classes;
}

export async function listMyClasses() {
  const { data } = await apiClient.get<{ classes: ClassSummary[] }>("/classes/mine");
  return data.classes;
}

export interface RosterStudent {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
}

export async function listClassStudents(classId: string) {
  const { data } = await apiClient.get<{ students: RosterStudent[] }>(`/classes/${classId}/students`);
  return data.students;
}

export async function createClass(input: {
  name: string;
  programmeId: string;
  campusId: string;
  academicYear: string;
  semester: number;
  lecturerId?: string;
}) {
  const { data } = await apiClient.post<ClassSummary>("/classes", input);
  return data;
}

export async function listStaff(role?: string) {
  const { data } = await apiClient.get<{ staff: StaffSummary[] }>("/staff", {
    params: role ? { role } : undefined,
  });
  return data.staff;
}

export async function enrolStudent(input: {
  studentId: string;
  subjectId: string;
  academicYear: string;
  semester: number;
}) {
  const { data } = await apiClient.post("/enrolments", input);
  return data;
}

export async function listStudentEnrolments(studentId: string) {
  const { data } = await apiClient.get<{ enrolments: unknown[] }>("/enrolments", { params: { studentId } });
  return data.enrolments;
}
