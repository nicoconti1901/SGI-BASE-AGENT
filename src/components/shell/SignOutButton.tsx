import { signOutAction } from "@/app/auth-actions";

/** Formulario simple: funciona aunque el JS del cliente no haya cargado. */
export function SignOutButton({ tone = "light" }: { tone?: "light" | "dark" }) {
  const toneClass =
    tone === "dark"
      ? "border-white/30 text-white hover:bg-white/10"
      : "border-[var(--color-line-strong)] text-[var(--color-ink)] hover:border-[var(--color-danger)] hover:text-[var(--color-danger)]";

  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={`inline-flex items-center gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-sm font-semibold transition duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)] ${toneClass}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M13 14l4-4-4-4M17 10H8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Cerrar sesión
      </button>
    </form>
  );
}
