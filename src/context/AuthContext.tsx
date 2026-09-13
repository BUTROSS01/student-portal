import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "../api/client";
import { setAccessToken } from "../api/client";
import { loginRequest, logoutRequest, AuthenticatedUser, Role } from "../api/auth";

interface AuthContextValue {
  user: AuthenticatedUser | null;
  loading: boolean;
  mustChangePassword: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ twoFactorRequired?: boolean }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  useEffect(() => {
    // On first load there's no access token in memory yet (it's never
    // persisted to localStorage — see the design note in ProtectedRoute).
    // Try a silent refresh against the httpOnly cookie to restore the
    // session if one exists.
    apiClient
      .post("/auth/refresh")
      .then(async (res) => {
        setAccessToken(res.data.accessToken);
        const me = await apiClient.get("/auth/me");
        setUser({ id: me.data.id, email: me.data.email, role: me.data.role.name as Role });
      })
      .catch(() => {
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string, totpCode?: string) {
    const result = await loginRequest(email, password, totpCode);
    if (result.twoFactorRequired) {
      return { twoFactorRequired: true };
    }
    if (result.accessToken && result.user) {
      setAccessToken(result.accessToken);
      setUser(result.user);
      setMustChangePassword(Boolean(result.mustChangePassword));
    }
    return {};
  }

  async function logout() {
    await logoutRequest().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, mustChangePassword, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
