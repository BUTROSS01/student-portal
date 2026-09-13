import { apiClient } from "./client";

export type Role =
  | "SUPER_ADMIN"
  | "MANAGEMENT"
  | "ACADEMIC_ADMIN"
  | "LECTURER"
  | "FINANCE"
  | "STUDENT"
  | "PARENT";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export interface LoginResult {
  accessToken?: string;
  mustChangePassword?: boolean;
  user?: AuthenticatedUser;
  twoFactorRequired?: boolean;
}

export async function loginRequest(email: string, password: string, totpCode?: string) {
  const { data } = await apiClient.post<LoginResult>("/auth/login", { email, password, totpCode });
  return data;
}

export async function logoutRequest() {
  await apiClient.post("/auth/logout");
}

export async function fetchCurrentUser() {
  const { data } = await apiClient.get("/auth/me");
  return data;
}
