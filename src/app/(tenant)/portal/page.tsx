export default function TenantPortalPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--color-ink)]">
          Portal del cliente
        </h1>
        <p className="mt-2 text-[var(--color-ink-muted)]">
          Shell vacío con identidad visual de tenant. Los módulos de documentos,
          operaciones y automatizaciones se conectan en tareas posteriores.
        </p>
      </div>
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface)] px-5 py-8 text-sm text-[var(--color-ink-muted)]">
        Próximo: dashboard de cumplimiento y vencimientos (Task 12).
      </div>
    </div>
  );
}
