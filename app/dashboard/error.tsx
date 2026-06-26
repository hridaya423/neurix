"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="dashboard-shell dashboard-shell-centered">
      <div className="dashboard-error">
        <span className="dashboard-error-mark" aria-hidden="true">
          <AlertTriangle size={24} strokeWidth={2.2} />
        </span>
        <h1>Something went sideways</h1>
        <p>
          We couldn&apos;t load your projects just now. This is usually
          temporary — try again, or head back to the dashboard.
        </p>
        <div className="dashboard-error-actions">
          <button className="btn btn-primary" type="button" onClick={reset}>
            <RotateCcw size={15} strokeWidth={2.4} />
            Try again
          </button>
          <Link className="btn btn-secondary" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}
