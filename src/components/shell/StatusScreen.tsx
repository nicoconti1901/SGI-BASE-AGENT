import Link from "next/link";
import { SignOutButton } from "@/components/shell/SignOutButton";

/** Pantalla mínima para casos sin shell: sin acceso, sin empresa asignada. */
export function StatusScreen({
  title,
  body,
  action,
}: {
  title: string;
  body: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-6 shadow-[var(--shadow-soft)]">
        <h1 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">{body}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {action ? (
            <Link
              href={action.href}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)]"
            >
              {action.label}
            </Link>
          ) : null}
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
