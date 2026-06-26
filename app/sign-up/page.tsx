"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < 8;

  const signUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passwordTooShort) return;
    setIsSubmitting(true);
    setError(null);

    const result = await authClient.signUp.email({ name, email, password });
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? "Could not create account. Please try again.");
      return;
    }

    router.push("/dashboard");
  };

  return (
    <AuthScaffold
      tone="lilac"
      eyebrow="Start for free"
      heading="Block coding that grows into real code."
      lede="Create an account to save projects, import .sb3 files, and unlock AI block generation."
    >
      <div className="auth-card">
        <div className="auth-card-header">
          <h1>Create your <span className="lp-hi">account</span></h1>
          <p>Start saving Scratch-like projects with AI-powered blocks.</p>
        </div>

        <form className="auth-form" onSubmit={signUp} noValidate>
          <Field
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            autoComplete="name"
            placeholder="Your name"
          />
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
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            hint="Use at least 8 characters."
            error={passwordTooShort ? "Password must be at least 8 characters." : undefined}
          />

          {error && (
            <div className="auth-error" role="alert">
              <AlertCircle size={16} strokeWidth={2.2} />
              <span>{error}</span>
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            block
            loading={isSubmitting}
            disabled={passwordTooShort}
            className="auth-submit"
          >
            Create account
          </Button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link href="/sign-in">Sign in</Link>
        </div>
      </div>
    </AuthScaffold>
  );
}
