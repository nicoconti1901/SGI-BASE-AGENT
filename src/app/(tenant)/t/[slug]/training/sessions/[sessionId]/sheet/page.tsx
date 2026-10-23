import Link from "next/link";
import { notFound } from "next/navigation";
import { loadTrainingAccess } from "@/app/(tenant)/t/[slug]/training/access";
import { getSession } from "@/lib/training-records";
import { PrintButton } from "@/app/(tenant)/t/[slug]/training/RecordControls";

const day = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");

/**
 * Planilla de asistencia para imprimir y firmar: tema, contenido, duración, fecha, instructor y, por asistente,
 * nombre, DNI, puesto y firma (los campos que pide la Res. SRT 905/15). Al imprimir se ocultan el menú y las pestañas.
 */
export default async function SessionSheetPage({ params }: { params: Promise<{ slug: string; sessionId: string }> }) {
  const { slug, sessionId } = await params;
  const { tenant } = await loadTrainingAccess(slug);
  const session = await getSession(tenant.id, sessionId);
  if (!session || session.voidedAt) notFound();
  const people = session.records.filter((r) => !r.voidedAt);

  return (
    <article className="flex flex-col gap-5">
      <style>{`@media print { header, nav, aside, [role="banner"] { display: none !important; } body { background: #fff; } }`}</style>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Link href={`/t/${slug}/training/sessions/${session.id}`} className="text-sm font-medium text-[var(--color-accent)] hover:underline">
          ← Volver a la sesión
        </Link>
        <PrintButton label="Imprimir planilla" />
      </div>

      <header className="flex flex-col gap-1 border-b border-[var(--color-ink)] pb-3">
        <p className="text-sm">{tenant.name}</p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Planilla de asistencia a capacitación</h2>
      </header>

      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Tema</dt>
          <dd>{session.course.name}</dd>
        </div>
        <div>
          <dt className="font-semibold">Fecha</dt>
          <dd>{day(session.heldAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold">Duración</dt>
          <dd>{session.hours ? `${Number(session.hours)} horas` : "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold">Instructor</dt>
          <dd>
            {session.instructorName} ({session.instructorKind === "internal" ? "interno" : "externo"}
            {session.providerName ? `, ${session.providerName}` : ""})
          </dd>
        </div>
        {session.site ? (
          <div>
            <dt className="font-semibold">Lugar</dt>
            <dd>{session.site.name}</dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="font-semibold">Contenido</dt>
          <dd>{session.notes ?? <span className="text-[var(--color-ink-muted)]">—</span>}</dd>
        </div>
      </dl>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Asistentes</caption>
        <thead>
          <tr className="border-b border-t border-[var(--color-ink)] text-left">
            <th scope="col" className="w-10 py-2">N.º</th>
            <th scope="col" className="py-2">Apellido y nombre</th>
            <th scope="col" className="py-2">DNI</th>
            <th scope="col" className="py-2">Puesto</th>
            <th scope="col" className="w-56 py-2">Firma</th>
          </tr>
        </thead>
        <tbody>
          {people.map((r, i) => (
            <tr key={r.id} className="border-b border-[var(--color-line-strong)]">
              <td className="py-4 tabular-nums">{i + 1}</td>
              <td className="py-4">{r.person.name}</td>
              <td className="py-4 tabular-nums">{r.person.documentId ?? ""}</td>
              <td className="py-4">{r.person.position.name}</td>
              <td className="py-4" />
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-6 grid grid-cols-2 gap-10 text-sm">
        <span className="border-t border-[var(--color-ink)] pt-1">Firma del instructor</span>
        <span className="border-t border-[var(--color-ink)] pt-1">Firma del responsable de capacitación</span>
      </p>
    </article>
  );
}
