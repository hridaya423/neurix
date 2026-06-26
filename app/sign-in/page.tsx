"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

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
      setError(result.error.message ?? "Could not sign in. Check your details and try again.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <AuthScaffold
      tone="lime"
      eyebrow="Welcome back"
      heading="Back to building."
      lede="Your projects are saved and waiting. Sign in to keep creating with blocks and AI."
    >
      <div className="auth-card">
        <div className="auth-card-header">
          <h1>Sign in to <span className="lp-hi">Neurix</span></h1>
          <p>Pick up your sprites, sounds, and AI-generated blocks.</p>
        </div>

        <form className="auth-form" onSubmit={signIn} noValidate>
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} strokeWidth={2.2} />
              <span>{error}</span>
              </div>
          )}

          <Button type="submit" size="lg" block loading={isSubmitting} className="auth-submit">
            Sign in
          </Button>
        </form>

        <div className="auth-footer">
          New here? <Link href="/sign-up">Create an account</Link>
        </div>
      </div>
    </AuthScaffold>
  );
}
