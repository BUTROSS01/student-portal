import { FormEvent, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ROLE_DASHBOARD_PATH } from "../config/roles";
import { apiClient } from "../api/client";

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await login(email, password, needsTwoFactor ? totpCode : undefined);

      if (result.twoFactorRequired) {
        setNeedsTwoFactor(true);
        setSubmitting(false);
        return;
      }

      // Fetch the freshly-authenticated user to route to the right dashboard.
      const me = await apiClient.get("/auth/me");
      const role = me.data.role.name as keyof typeof ROLE_DASHBOARD_PATH;
      const redirectTo = (location.state as { from?: Location })?.from?.pathname ?? ROLE_DASHBOARD_PATH[role];
      navigate(redirectTo, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-5">
      {/* Institutional panel */}
      <div className="relative hidden flex-col justify-between bg-navy-900 px-12 py-14 text-paper md:col-span-2 md:flex">
        <div>
          <div className="mb-16 h-1 w-12 bg-gold-500" />
          <h1 className="font-display text-4xl leading-tight text-paper">
            Tshwane City
            <br />
            College
          </h1>
          <p className="mt-6 max-w-xs text-gold-100">Student &amp; Parent Portal</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">
            Results, fees, attendance, and college communication, all in one
            secure place for students, parents, and staff.
          </p>
        </div>
        <p className="text-xs text-paper/50">
          Having trouble signing in? Contact the IT Support Desk.
        </p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-col justify-center px-6 py-16 md:col-span-3 md:px-20">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="font-display text-2xl text-ink">Sign in to your portal</h2>
          <p className="mt-2 text-sm text-navy-700">
            Use the email address and password issued by the college.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={needsTwoFactor}
                className="mt-1.5 w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500 disabled:bg-navy-700/5"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-ink">
                  Password
                </label>
                <a href="/forgot-password" className="text-sm text-navy-800 underline decoration-gold-500">
                  Forgot password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={needsTwoFactor}
                className="mt-1.5 w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 text-ink focus-visible:border-gold-500 disabled:bg-navy-700/5"
              />
            </div>

            {needsTwoFactor && (
              <div>
                <label htmlFor="totp" className="block text-sm font-medium text-ink">
                  6-digit authentication code
                </label>
                <input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="mt-1.5 w-full rounded-sm border border-navy-700/30 bg-white px-3 py-2.5 tracking-[0.3em] text-ink focus-visible:border-gold-500"
                />
                <p className="mt-1.5 text-xs text-navy-700">
                  Open your authenticator app and enter the current code.
                </p>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-sm border border-rejected/30 bg-rejected/5 px-3 py-2 text-sm text-rejected">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-sm bg-navy-900 py-2.5 font-medium text-paper transition-colors hover:bg-navy-800 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : needsTwoFactor ? "Verify and sign in" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
