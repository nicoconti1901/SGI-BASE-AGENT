import Link from "next/link";
import {
  GUIDE_DEFINITIONS,
  GUIDE_REFERENCES,
  GUIDE_SECTIONS,
  SOURCE_GUIDANCE,
  WORKSPACE_STAGES,
} from "@/domain/risks/guide";
import { SOURCE_KIND_LABELS, SOURCE_KINDS } from "@/domain/risks/types";

export default async function RisksGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // El layout de la empresa ya verificó el acceso; la guía es de lectura para todos.
  const { slug } = await params;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
      <header>
        <Link href={`/t/${slug}/risks`} className="text-sm text-[var(--color-accent)]">
          ← Riesgos y oportunidades
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Guía para identificar riesgos y oportunidades
        </h1>
        <nav aria-label="Contenido" className="mt-4 flex flex-wrap gap-2 text-sm">
          {[
            { id: "que-es", title: "Qué es cada uno" },
            ...GUIDE_SECTIONS.map((s) => ({ id: s.id, title: s.title })),
            { id: "fuentes", title: "Preguntas por fuente" },
            { id: "etapas", title: "Las 4 etapas" },
          ].map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-1 hover:border-[var(--color-accent)]"
            >
              {s.title}
            </a>
          ))}
        </nav>
      </header>

      <Section id="que-es" title="Qué es cada uno">
        <div className="grid gap-4 sm:grid-cols-2">
          {(["risk", "opportunity"] as const).map((k) => {
            const d = GUIDE_DEFINITIONS[k];
            return (
              <div
                key={k}
                className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-5"
              >
                <h3 className="font-[family-name:var(--font-display)] text-xl">{d.title}</h3>
                <p className="mt-2 text-sm">{d.text}</p>
                <p className="mt-3 text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Cómo redactarlo
                </p>
                <p className="mt-1 text-sm font-medium">{d.formula}</p>
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">Ej.: {d.example}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {GUIDE_SECTIONS.map((s) => (
        <SectionBody key={s.id} section={s} />
      ))}

      <Section id="fuentes" title="Preguntas por tipo de fuente">
        <dl className="divide-y divide-[var(--color-line)] rounded-md border border-[var(--color-line)]">
          {SOURCE_KINDS.map((k) => (
            <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr]">
              <dt className="font-medium">{SOURCE_KIND_LABELS[k]}</dt>
              <dd className="text-sm">
                {SOURCE_GUIDANCE[k].question}
                <span className="block text-xs text-[var(--color-ink-muted)]">
                  Ej.: {SOURCE_GUIDANCE[k].example}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="etapas" title="Las 4 etapas del registro">
        <ol className="flex flex-col gap-3">
          {WORKSPACE_STAGES.map((st) => (
            <li key={st.key} className="rounded-md border border-[var(--color-line)] px-4 py-3">
              <p className="font-medium">{st.title}</p>
              <p className="text-sm text-[var(--color-ink-muted)]">{st.what}</p>
              <p className="mt-1 text-sm">
                <strong>Qué hacer:</strong> {st.next}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <footer className="border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-muted)]">
        <p className="font-medium">Referencias</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {GUIDE_REFERENCES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-3">
      <h2 className="font-[family-name:var(--font-display)] text-2xl">{title}</h2>
      {children}
    </section>
  );
}

function SectionBody({ section }: { section: (typeof GUIDE_SECTIONS)[number] }) {
  return (
    <Section id={section.id} title={section.title}>
      {section.paragraphs?.map((p) => (
        <p key={p} className="leading-relaxed">
          {p}
        </p>
      ))}
      {section.items ? (
        <dl className="flex flex-col gap-2">
          {section.items.map((it) => (
            <div key={it.term} className="text-sm">
              <dt className="inline font-semibold">{it.term}: </dt>
              <dd className="inline">{it.text}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Section>
  );
}
