import { Link, Navigate } from "@tanstack/react-router";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

// This is an agency workspace, rather than a subscription marketing site.
// Dashboard's existing authentication flow preserves the requested destination.
export default function Homepage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
      <Brand />
      <p role="status" className="text-sm text-muted">
        Opening your content workspace…
      </p>
      <Button asChild>
        <Link to="/dashboard">Open workspace</Link>
      </Button>
      <Navigate to="/dashboard" replace />
    </main>
  );
}
