import Link from "next/link";
import { CALIBRATION_GUIDE_REFERENCES, CALIBRATION_GUIDE_SECTIONS } from "@/domain/calibration/guide";

export default async function InstrumentsGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  // El layout del módulo ya verificó el acceso; la guía es de lectura para todos.
  const { slug } = await params;

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-10 px-1 py-4">
      <header>
        <Link href={`/t/${slug}/instruments`} className="text-sm text-[var(--color-accent)]">
          ← Equipos de medición
        </Link>
        <p className="mt-2 text-sm text-[var(--color-ink-muted)]">ISO 9001 §7.1.5 · ISO 14001 y 45001 §9.1.1</p>
        <h2 className="font-[family-name:var(--font-display)] text-3xl tracking-tight">Guía de equipos de medición</h2>
        <nav aria-label="Contenido" className="mt-4 flex flex-wrap gap-2 text-sm">
          {CALIBRATION_GUIDE_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-1 hover:border-[var(--color-accent)]">
              {s.title}
            </a>
          ))}
        </nav>
      </header>

      {CALIBRATION_GUIDE_SECTIONS.map((section) => (
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
          {CALIBRATION_GUIDE_REFERENCES.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </footer>
    </article>
  );
}
