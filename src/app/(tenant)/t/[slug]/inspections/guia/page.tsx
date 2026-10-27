import Link from "next/link";
import { SectionBlock, StatusChip } from "@/components/ui";
import { FOLLOW_UP_DAYS } from "@/domain/inspections/consequences";

export const metadata = { title: "Guía de inspecciones" };

const RESULTS = [
  { status: "ok", label: "Apto", rule: "Todos los ítems que aplican cumplen.", effect: "El equipo sigue en servicio y se programa el próximo control." },
  {
    status: "warning",
    label: "Apto con observaciones",
    rule: "Hay algo que no cumple, pero ningún ítem crítico.",
    effect: "El equipo sigue en servicio. Se abre una acción para corregir lo observado.",
  },
  {
    status: "danger",
    label: "No apto",
    rule: "Al menos un ítem crítico no cumple.",
    effect: "El equipo queda fuera de servicio, se abre una acción con plazo y se programa una reinspección.",
  },
] as const;

export default async function GuiaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return (
    <div className="flex flex-col gap-6">
      <SectionBlock
        title="Cómo se calcula el resultado"
        what="Nadie elige el resultado: sale de las respuestas, con la misma regla para todos los equipos."
        next="respondé cada ítem con lo que ves. Si dudás, marcá «No conforme» y contalo en el comentario."
      >
        <ul className="grid gap-3 md:grid-cols-3">
          {RESULTS.map((r) => (
            <li key={r.label} className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4 text-sm">
              <StatusChip status={r.status} label={r.label} />
              <p className="font-semibold">{r.rule}</p>
              <p className="text-[var(--color-ink-muted)]">{r.effect}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-[var(--color-ink-muted)]">
          El porcentaje que se muestra es informativo (ítems que cumplen sobre ítems que aplican). Un porcentaje alto nunca tapa un ítem crítico: manda la criticidad.
        </p>
      </SectionBlock>

      <SectionBlock title="Qué significa cada criticidad" what="Cada ítem de la plantilla tiene una criticidad. Es lo que decide si una falla deja el equipo parado.">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-semibold">Crítico</dt>
            <dd className="text-[var(--color-ink-muted)]">Compromete la seguridad o el funcionamiento. El equipo no se usa hasta resolverlo. Pide foto. Plazo propuesto: {FOLLOW_UP_DAYS.critical * 24} horas.</dd>
          </div>
          <div>
            <dt className="font-semibold">Mayor</dt>
            <dd className="text-[var(--color-ink-muted)]">Hay que corregirlo, pero el equipo puede seguir en servicio. Pide foto. Plazo propuesto: {FOLLOW_UP_DAYS.major} días.</dd>
          </div>
          <div>
            <dt className="font-semibold">Menor</dt>
            <dd className="text-[var(--color-ink-muted)]">Una mejora u orden pendiente. La foto es opcional. Plazo propuesto: {FOLLOW_UP_DAYS.minor} días.</dd>
          </div>
        </dl>
      </SectionBlock>

      <SectionBlock title="Qué pasa con el equipo" what="Al cerrar y firmar, el sistema hace todo esto en un solo paso. No hace falta cargar nada más.">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm">
          <li>
            <span className="font-semibold">El estado del equipo:</span> si el resultado es «No apto», pasa a «Fuera de servicio» y queda anotado quién lo decidió y por qué.
          </li>
          <li>
            <span className="font-semibold">La próxima fecha:</span> con un resultado apto se cuenta la frecuencia de la plantilla desde el día de la inspección. Con «No apto» se pide una reinspección en 7 días.
          </li>
          <li>
            <span className="font-semibold">El seguimiento:</span> con cualquier no conformidad se crea una acción con responsable y plazo. Si la plantilla lo indica, ante un ítem crítico también se abre un hallazgo borrador.
          </li>
          <li>
            <span className="font-semibold">Volver a servicio:</span> lo hace una reinspección periódica apta, cerrada por un responsable de proceso o el administrador. Un colaborador puede registrarla, pero el equipo queda «pendiente de liberación».
          </li>
        </ol>
      </SectionBlock>

      <SectionBlock title="Buenas prácticas" what="Lo que hace que una inspección sirva como evidencia ante una auditoría.">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-sm">
          <li>Sacá la foto en el momento y de cerca: tiene que verse el problema.</li>
          <li>Podés cargar una inspección de hasta 7 días atrás (por ejemplo, si no tenías señal). No se aceptan fechas futuras.</li>
          <li>Una inspección cerrada no se edita. Si hay un error, un responsable de proceso o el administrador la corrige con un motivo, y la corrección queda registrada.</li>
          <li>Con «No aplica» solo se omite lo que de verdad no corresponde a ese equipo. No sirve para saltear un ítem.</li>
        </ul>
      </SectionBlock>

      <SectionBlock title="Dónde se cambia lo que se controla" what="Los ítems, su criticidad y la frecuencia viven en las plantillas.">
        <p className="text-sm">
          El administrador puede ajustarlos en{" "}
          <Link href={`/t/${slug}/inspections/templates`} className="font-medium text-[var(--color-accent)] hover:underline">
            Plantillas
          </Link>
          . Cada cambio crea una versión nueva y las inspecciones ya hechas conservan los ítems con los que se hicieron.
        </p>
      </SectionBlock>
    </div>
  );
}
