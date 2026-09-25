import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listCatalogRequirements } from "@/lib/ims-catalog";
import type { IsoStandardCode } from "@/domain/ims/catalog";

const STANDARDS: Array<IsoStandardCode | "ALL"> = [
  "ALL",
  "ISO9001",
  "ISO14001",
  "ISO45001",
];

type SearchParams = Promise<{ standard?: string; essential?: string }>;

export default async function PlatformCatalogPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const standardParam = params.standard;
  const standard =
    standardParam === "ISO9001" ||
    standardParam === "ISO14001" ||
    standardParam === "ISO45001"
      ? standardParam
      : undefined;
  const essentialOnly = params.essential === "1";

  const requirements = await listCatalogRequirements({
    standard,
    essential: essentialOnly ? true : undefined,
  });

  const counts = {
    total: requirements.length,
    essential: requirements.filter((r) => r.essential).length,
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Catálogo ISO
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Requisitos base 9001 / 14001 / 45001. Esenciales alimentan plantillas
          greenfield; escalables se activan al crecer el SGI.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STANDARDS.map((item) => {
          const href =
            item === "ALL"
              ? `/platform/catalog${essentialOnly ? "?essential=1" : ""}`
              : `/platform/catalog?standard=${item}${essentialOnly ? "&essential=1" : ""}`;
          const active =
            (item === "ALL" && !standard) || item === standard;
          return (
            <Link
              key={item}
              href={href}
              className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "border border-[var(--color-line)] bg-[var(--color-surface-raised)] text-[var(--color-ink)] hover:border-[var(--color-accent)]"
              }`}
            >
              {item === "ALL" ? "Todas" : item}
            </Link>
          );
        })}
        <Link
          href={
            standard
              ? `/platform/catalog?standard=${standard}${essentialOnly ? "" : "&essential=1"}`
              : `/platform/catalog${essentialOnly ? "" : "?essential=1"}`
          }
          className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium ${
            essentialOnly
              ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
              : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-muted)]"
          }`}
        >
          Solo esenciales
        </Link>
      </div>

      <p className="text-sm text-[var(--color-ink-subtle)]">
        Mostrando {counts.total} requisitos
        {essentialOnly ? ` (${counts.essential} esenciales)` : ""}.
      </p>

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-soft)]">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-subtle)]">
            <tr>
              <th className="px-4 py-3 font-medium">Norma</th>
              <th className="px-4 py-3 font-medium">Cláusula</th>
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {requirements.map((requirement) => (
              <tr
                key={requirement.clauseKey}
                className="border-b border-[var(--color-line)] last:border-b-0"
              >
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                  {requirement.standard}
                </td>
                <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs">
                  {requirement.clauseCode}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-ink)]">
                    {requirement.title}
                  </p>
                  <p className="mt-1 text-[var(--color-ink-muted)]">
                    {requirement.summary}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium ${
                      requirement.essential
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]"
                        : "bg-[var(--color-surface)] text-[var(--color-ink-subtle)]"
                    }`}
                  >
                    {requirement.essential ? "Esencial" : "Escalable"}
                  </span>
                </td>
              </tr>
            ))}
            {requirements.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[var(--color-ink-muted)]"
                >
                  No hay requisitos para este filtro. Ejecutá{" "}
                  <code className="font-[family-name:var(--font-mono)] text-xs">
                    npm run db:seed
                  </code>
                  .
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
