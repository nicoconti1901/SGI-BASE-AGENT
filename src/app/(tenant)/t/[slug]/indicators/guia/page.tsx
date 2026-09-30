import Link from "next/link";
import { INDICATOR_GUIDE_REFERENCES, INDICATOR_GUIDE_SECTIONS } from "@/domain/indicators/guide";

export default async function IndicatorGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  // El layout de la empresa ya verificó el acceso; la guía es de lectura para todos.
  const { slug } = await params;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-8">
      <header>
        <Link href={`/t/${slug}/indicators`} className="text-sm text-[var(--color-accent)]">
          ← Objetivos e indicadores
        </Link>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">ISO 9001 · 14001 · 45001 · §6.2 · §9.1</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">
          Guía de objetivos e indicadores
        </h1>
        <nav aria-label="Contenido" className="mt-4 flex flex-wrap gap-2 text-sm">
          {INDICATOR_GUIDE_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1 hover:border-[var(--color-accent)]"
            >
              {s.title}
            </a>
          ))}
        </nav>
      </header>

      {INDICATOR_GUIDE_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-6 flex-col gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-xl">{section.title}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="leading-relaxed">
              {p}
            </p>
          ))}
          {section.items ? (
            <dl className="flex flex-col gap-2">
              {section.items.map((it) => (
                <div key={it.text} className="text-sm">
                  <dt className="inline font-semibold">{it.term}: </dt>
                  <dd className="inline">{it.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </section>
      ))}

      <footer className="border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-muted)]">
        <p className="font-medium">Referencias</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {INDICATOR_GUIDE_REFERENCES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
