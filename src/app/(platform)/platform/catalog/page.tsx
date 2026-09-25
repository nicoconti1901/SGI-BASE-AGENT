import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listCatalogRequirements } from "@/lib/ims-catalog";
import type { IsoStandardCode } from "@/domain/ims/catalog";
import { prisma } from "@/lib/db";

const STANDARDS: Array<IsoStandardCode | "ALL"> = [
  "ALL",
  "ISO9001",
  "ISO14001",
  "ISO45001",
];

type SearchParams = Promise<{ standard?: string; essential?: string }>;

function catalogHref(opts: {
  standard?: IsoStandardCode;
  essentialOnly: boolean;
}) {
  const params = new URLSearchParams();
  if (opts.standard) params.set("standard", opts.standard);
  if (opts.essentialOnly) params.set("essential", "1");
  const qs = params.toString();
  return qs ? `/platform/catalog?${qs}` : "/platform/catalog";
}

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

  const [requirements, totals] = await Promise.all([
    listCatalogRequirements({
      standard,
      essential: essentialOnly ? true : undefined,
    }),
    prisma.isoRequirement.groupBy({
      by: ["essential"],
      _count: { _all: true },
    }),
  ]);

  const essentialTotal =
    totals.find((row) => row.essential === true)?._count._all ?? 0;
  const allTotal = totals.reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Catálogo ISO
        </h1>
        <p className="mt-2 max-w-3xl text-[var(--color-ink-muted)]">
          Mapa completo de cláusulas operativas de ISO 9001, 14001 y 45001. Las
          marcadas como <strong>esenciales</strong> forman la base para empresas
          primerizas; el resto se activa al escalar el SGI.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total en catálogo" value={String(allTotal)} />
        <StatCard
          label="Esenciales (primerizas)"
          value={String(essentialTotal)}
          accent
        />
        <StatCard
          label="Vista actual"
          value={String(requirements.length)}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-4 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-subtle)]">
            Norma
          </span>
          {STANDARDS.map((item) => {
            const itemStandard = item === "ALL" ? undefined : item;
            const href = catalogHref({
              standard: itemStandard,
              essentialOnly,
            });
            const active =
              (item === "ALL" && !standard) || item === standard;
            return (
              <Link
                key={item}
                href={href}
                className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-accent)]"
                }`}
              >
                {item === "ALL" ? "Todas" : item}
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-3">
          <span className="text-xs uppercase tracking-[0.18em] text-[var(--color-ink-subtle)]">
            Alcance
          </span>
          <Link
            href={catalogHref({ standard, essentialOnly: false })}
            className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium ${
              !essentialOnly
                ? "bg-[var(--color-ink)] text-[var(--color-surface)]"
                : "border border-[var(--color-line)] text-[var(--color-ink-muted)]"
            }`}
          >
            Catálogo completo
          </Link>
          <Link
            href={catalogHref({ standard, essentialOnly: true })}
            className={`rounded-[var(--radius-md)] px-3 py-1.5 text-sm font-medium ${
              essentialOnly
                ? "bg-[var(--color-accent)] text-white"
                : "border border-[var(--color-line)] text-[var(--color-ink-muted)]"
            }`}
          >
            Solo esenciales · empresas primerizas
          </Link>
        </div>
      </div>

      <p className="text-sm text-[var(--color-ink-subtle)]">
        {essentialOnly
          ? `Mostrando ${requirements.length} requisitos esenciales (baseline greenfield).`
          : `Mostrando ${requirements.length} requisitos del catálogo completo.`}
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

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border px-4 py-3 ${
        accent
          ? "border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]"
          : "border-[var(--color-line)] bg-[var(--color-surface-raised)]"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-ink-subtle)]">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
        {value}
      </p>
    </div>
  );
}
