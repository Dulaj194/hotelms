import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import type { ForgotPasswordResponse } from "@/types/auth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [devToken, setDevToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<ForgotPasswordResponse>(
        "/auth/forgot-password",
        { email }
      );
      setMessage(data.message);
      if (data.dev_reset_token) {
        setDevToken(data.dev_reset_token);
      }
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 p-8 border border-border rounded-lg shadow-sm bg-card">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Reset password
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you reset instructions.
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-sm border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? "Sending…" : "Send reset instructions"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm text-foreground">{message}</p>
            </div>

            {devToken && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md space-y-1">
                <p className="text-xs font-semibold text-yellow-800">
                  DEV MODE — Reset Token
                </p>
                <p className="text-xs text-yellow-700 break-all font-mono">
                  {devToken}
                </p>
                <Link
                  to={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  className="text-xs text-yellow-800 underline"
                >
                  Open reset page →
                </Link>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link
            to="/login"
            className="underline underline-offset-4 hover:text-foreground transition-colors"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
