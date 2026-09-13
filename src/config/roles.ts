import { Role } from "../api/auth";

export const ROLE_DASHBOARD_PATH: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  MANAGEMENT: "/management",
  ACADEMIC_ADMIN: "/academic",
  LECTURER: "/lecturer",
  FINANCE: "/finance",
  STUDENT: "/student",
  PARENT: "/parent",
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Administrator",
  MANAGEMENT: "College Management",
  ACADEMIC_ADMIN: "Academic Administrator",
  LECTURER: "Lecturer",
  FINANCE: "Finance",
  STUDENT: "Student",
  PARENT: "Parent / Guardian",
};
