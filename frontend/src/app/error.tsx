"use client";

import { useEffect } from "react";

type ErrorBoundaryProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function Error({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log uncaught error to client console for diagnostics without exposing sensitive data in UI
    console.error("Unhandled client error caught by boundary:", error);
  }, [error]);

  const safeDigest = typeof error?.digest === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(error.digest)
    ? error.digest
    : null;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <section
        role="alert"
        aria-labelledby="error-title"
        className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-sm"
      >
        <h1 id="error-title" className="text-2xl font-semibold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          An unexpected error occurred. You can try again.
        </p>
        {safeDigest && (
          <p className="mt-2 text-xs font-mono text-muted-foreground">
            Error reference: {safeDigest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Go to Home
          </a>
        </div>
      </section>
    </div>
  );
}
