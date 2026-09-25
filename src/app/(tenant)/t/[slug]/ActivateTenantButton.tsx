"use client";

import { useTransition } from "react";
import { activateTenantAction } from "@/app/(tenant)/t/[slug]/users/actions";

export function ActivateTenantButton({ slug }: { slug: string }) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => activateTenantAction(slug))}
      className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] px-4 py-2 text-sm font-medium hover:border-[var(--color-accent)] disabled:opacity-60"
    >
      {pending ? "Activando…" : "Activar este tenant en mi sesión"}
    </button>
  );
}
