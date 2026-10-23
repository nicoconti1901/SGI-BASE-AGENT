import { TRAINING_GUIDE_REFERENCES, TRAINING_GUIDE_SECTIONS } from "@/domain/training/guide";

export default function TrainingGuidePage() {
  // El layout de Capacitaciones ya verificó el acceso y el módulo; la guía es de lectura para todos.
  return (
    <article className="flex max-w-3xl flex-col gap-8 py-2">
      <header>
        <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight">Guía de Capacitaciones</h2>
        <nav aria-label="Contenido de la guía" className="mt-4 flex flex-wrap gap-2 text-sm">
          {TRAINING_GUIDE_SECTIONS.map((s) => (
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

      {TRAINING_GUIDE_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="flex scroll-mt-6 flex-col gap-3">
          <h3 className="font-[family-name:var(--font-display)] text-xl">{section.title}</h3>
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
        </section>
      ))}

      <footer className="border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-ink-muted)]">
        <p className="font-medium">Referencias</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {TRAINING_GUIDE_REFERENCES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
