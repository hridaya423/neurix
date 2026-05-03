"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.signIn.email({ email, password });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not sign in.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="auth-shell">
      <div className="auth-bg-orb auth-bg-orb-1" />
      <div className="auth-bg-orb auth-bg-orb-2" />
      <div className="auth-bg-orb auth-bg-orb-3" />

      <div className="auth-card">
        <div className="auth-card-brand">
          <div className="auth-card-mark">
            <div className="auth-card-mark-inner" />
          </div>
          <span>Neurix</span>
        </div>

        <div className="auth-card-header">
          <h1>Welcome back</h1>
          <p>Sign in to save projects, sprites, and AI-generated blocks.</p>
        </div>

        <form className="auth-form" onSubmit={signIn}>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              required
              placeholder="you@example.com"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              required
              placeholder="Enter your password"
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="auth-spinner">
                <span />
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <div className="auth-footer">
          New here?{" "}
          <Link href="/sign-up">Create an account</Link>
        </div>
      </div>
    </main>
  );
}
