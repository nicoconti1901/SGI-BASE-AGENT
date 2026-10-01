import Link from "next/link";
import { listPeople, listSites } from "@/lib/masterdata";
import { SitePicker } from "@/components/pickers/SitePicker";
import { loadMasterDataAccess } from "@/app/(tenant)/t/[slug]/master-data/access";
import { EMPLOYER_LABELS } from "@/domain/masterdata/types";
import { Button, EmptyState, Field, INPUT_CLASS, SectionBlock, StatusChip, buttonClass } from "@/components/ui";

type SearchParams = Promise<{ q?: string; sede?: string; estado?: string }>;

export default async function PeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { tenant, canManage } = await loadMasterDataAccess(slug);
  const status = sp.estado === "inactive" || sp.estado === "all" ? sp.estado : "active";
  const [people, sites] = await Promise.all([
    listPeople(tenant.id, { status, siteId: sp.sede || undefined, q: sp.q }),
    listSites(tenant.id),
  ]);
  const base = `/t/${slug}/master-data/people`;
  const filtered = Boolean(sp.q || sp.sede || sp.estado);

  return (
    <SectionBlock
      title={`Personas (${people.length})`}
      what="La nómina propia y de contratistas. No hace falta que usen el sistema."
      next={canManage ? "cargá cada persona o importá la nómina completa desde un CSV." : "consultá quién trabaja en cada sede."}
      actions={
        canManage ? (
          <>
            <Link href={`${base}/new`} className={buttonClass("primary")}>
              Registrar persona
            </Link>
            <Link href={`${base}/import`} className={buttonClass("secondary")}>
              Importar nómina
            </Link>
          </>
        ) : undefined
      }
    >
      <form method="get" className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field label="Buscar" hint="Por nombre o legajo.">
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Ej.: Pérez o 1042" className={INPUT_CLASS} />
        </Field>
        <SitePicker sites={sites} name="sede" label="Sede" hint="Incluye a quien rota por ella." defaultValue={sp.sede ?? ""} allLabel="Todas" />
        <Field label="Estado">
          <select name="estado" defaultValue={status} className={INPUT_CLASS}>
            <option value="active">Activas</option>
            <option value="inactive">De baja</option>
            <option value="all">Todas</option>
          </select>
        </Field>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>

      {people.length === 0 ? (
        <EmptyState
          what={filtered ? "Ninguna persona coincide con el filtro." : "Todavía no hay personas cargadas."}
          next={filtered ? "probá con otra búsqueda o limpiá el filtro." : canManage ? "registrá la primera persona o importá la nómina por CSV." : "pedile al administrador que cargue la nómina."}
          action={canManage && !filtered ? { href: `${base}/import`, label: "Importar nómina" } : undefined}
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-line)]">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <caption className="sr-only">Personas de la empresa</caption>
            <thead className="border-b border-[var(--color-line)] bg-[var(--color-surface-sunken)] font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Legajo</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Nombre</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">DNI</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Puesto</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Sede base</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Empresa</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {people.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] tabular-nums">{p.employeeCode}</td>
                  <td className="px-4 py-3">
                    <Link href={`${base}/${p.id}`} className="font-medium text-[var(--color-accent)] hover:underline">
                      {p.name}
                    </Link>
                    {p.extraSites.length > 0 ? (
                      <span className="block text-xs text-[var(--color-ink-muted)]">
                        También en: {p.extraSites.map((e) => e.site.name).join(", ")}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{p.documentId ?? "—"}</td>
                  <td className="px-4 py-3">{p.position.name}</td>
                  <td className="px-4 py-3">{p.site.name}</td>
                  <td className="px-4 py-3">
                    {EMPLOYER_LABELS[p.employer]}
                    {p.contractorName ? <span className="block text-xs text-[var(--color-ink-muted)]">{p.contractorName}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <StatusChip status={p.status === "active" ? "ok" : "pending"} label={p.status === "active" ? "Activa" : "De baja"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionBlock>
  );
}
