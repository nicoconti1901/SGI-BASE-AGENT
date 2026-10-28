import { HintCallout, SectionBlock, StatusChip, type ChipStatus } from "@/components/ui";
import { getEnabledModulesCached } from "@/lib/modules";
import { listSites } from "@/lib/masterdata";
import { getIncidentFicha, type SafetyUser } from "@/lib/safety-stats";
import { canManageHealthData, canReportIncident } from "@/domain/safety-stats/access";
import { instantToLocalInput } from "@/domain/safety-stats/period";
import {
  CLASSIFICATION_LABELS,
  EMPLOYER_LABELS,
  SAFETY_TIME_ZONE,
  labelAccidentForm,
  labelBodyPart,
  labelMaterialAgent,
  labelNature,
  type IncidentClassification,
} from "@/domain/safety-stats/types";
import { AddFichaForm, FactForm, FollowUpForm, HealthForm } from "@/app/(tenant)/t/[slug]/safety/FichaForms";

const CHIP: Record<IncidentClassification, ChipStatus> = {
  near_miss: "info",
  first_aid: "ok",
  no_lost_time: "warning",
  lost_time: "danger",
  fatal: "overdue",
  occupational_disease: "warning",
  property_damage_only: "info",
};

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10).split("-").reverse().join("/") : "—");
const dateTime = (d: Date) => d.toLocaleString("es-AR", { timeZone: SAFETY_TIME_ZONE, dateStyle: "short", timeStyle: "short" });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

function Collapsible({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--color-accent)]">{summary}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

/**
 * Ficha de accidente de un Hallazgo de tipo incidente. Leerla deja registro (quién, cuándo) y el
 * personal de plataforma no recibe los datos de salud. Solo aparece si el módulo está activo.
 */
export async function IncidentFichaCard({
  slug,
  tenantId,
  findingId,
  findingType,
  actor,
}: {
  slug: string;
  tenantId: string;
  findingId: string;
  findingType: string;
  actor: SafetyUser;
}) {
  if (!(await getEnabledModulesCached(tenantId)).has("safety_stats")) return null;
  const canManage = canManageHealthData(actor);
  const canReport = canReportIncident(actor);

  const ficha = await getIncidentFicha({ tenantId, findingId, actor });
  if (!ficha) {
    if (findingType !== "incident" || !canReport) return null;
    const sites = (await listSites(tenantId)).map((s) => ({ id: s.id, name: s.name }));
    return (
      <SectionBlock
        title="Ficha de accidente"
        eyebrow="ISO 45001 · §9.1.1 · §10.2"
        what="Este incidente todavía no tiene ficha, así que no entra en los índices de accidentabilidad."
        next="completá el hecho. La persona afectada y los días los completa después el administrador o el responsable de proceso."
      >
        <AddFichaForm slug={slug} findingId={findingId} sites={sites} />
      </SectionBlock>
    );
  }

  const { fact, health, followUps } = ficha;
  const open = fact.classification === "lost_time" && !fact.returnToWorkDate;
  const sites = canManage ? (await listSites(tenantId)).map((s) => ({ id: s.id, name: s.name })) : [];
  const chargePct = Number(fact.chargePct);

  return (
    <SectionBlock
      title="Ficha de accidente"
      eyebrow="ISO 45001 · §9.1.1 · §10.2"
      what="El hecho y la persona afectada. Alimenta los índices de accidentabilidad."
      actions={<StatusChip status={CHIP[fact.classification]} label={CLASSIFICATION_LABELS[fact.classification]} />}
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <Row label="Fecha y hora">{dateTime(fact.occurredAt)}</Row>
        <Row label="Sede">{fact.site.name}</Row>
        <Row label="Personal">{EMPLOYER_LABELS[fact.employerKind]}</Row>
        <Row label="Forma del accidente">{labelAccidentForm(fact.accidentForm)}</Row>
        <Row label="Agente">{labelMaterialAgent(fact.materialAgent)}</Row>
        <Row label="Trayecto / tránsito">
          {[fact.inItinere ? "En el trayecto al trabajo" : null, fact.isRoad ? "Hecho de tránsito" : null].filter(Boolean).join(" · ") || "No"}
        </Row>
        {fact.classification === "lost_time" ? (
          <Row label="Días de baja">
            {fact.lostDays}
            {open ? " (sigue de baja, contados hasta hoy)" : ` · reintegro ${day(fact.returnToWorkDate)}`}
            {chargePct > 0 ? ` · incapacidad permanente ${chargePct} %` : ""}
          </Row>
        ) : null}
        {fact.restrictedWork ? <Row label="Tareas">Volvió con tareas restringidas</Row> : null}
      </dl>
      {fact.inItinere ? (
        <HintCallout>Un accidente en el trayecto se muestra aparte y no entra en los índices.</HintCallout>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Persona afectada y lesión</h3>
        {!ficha.healthVisible ? (
          <p className="text-sm text-[var(--color-ink-muted)]">Los datos de salud no se muestran al personal de plataforma.</p>
        ) : health ? (
          <dl className="grid gap-4 sm:grid-cols-3">
            <Row label="Persona">
              {health.affectedPerson ? `${health.affectedPerson.name} · legajo ${health.affectedPerson.employeeCode}` : "—"}
            </Row>
            <Row label="Naturaleza de la lesión">{labelNature(health.natureOfInjury)}</Row>
            <Row label="Parte del cuerpo">{labelBodyPart(health.bodyPart)}</Row>
            <Row label="N.° de denuncia a la ART">{health.artClaimNumber ?? "—"}</Row>
            {health.deathDate ? <Row label="Fecha de la muerte">{day(health.deathDate)}</Row> : null}
          </dl>
        ) : (
          <p className="text-sm text-[var(--color-ink-muted)]">
            {fact.classification === "near_miss"
              ? "Un casi accidente no necesita persona afectada."
              : "Falta completar la ficha de salud. La completa el administrador o el responsable de proceso."}
          </p>
        )}
        {ficha.healthVisible ? (
          <p className="text-xs text-[var(--color-ink-muted)]">
            Datos de salud: los ven todos los usuarios de la empresa y cada consulta queda registrada.
          </p>
        ) : null}
        {canManage && ficha.healthVisible ? (
          <Collapsible summary={health ? "Editar la ficha de salud" : "Completar la ficha de salud"}>
            <HealthForm
              slug={slug}
              findingId={findingId}
              classification={fact.classification}
              defaults={{
                person: health?.affectedPerson
                  ? { id: health.affectedPerson.id, name: health.affectedPerson.name, employeeCode: health.affectedPerson.employeeCode, siteName: fact.site.name }
                  : null,
                natureOfInjury: health?.natureOfInjury,
                bodyPart: health?.bodyPart,
                artClaimNumber: health?.artClaimNumber,
                deathDate: health?.deathDate ? health.deathDate.toISOString().slice(0, 10) : null,
              }}
            />
          </Collapsible>
        ) : null}
      </div>

      {ficha.healthVisible ? (
        <div className="flex flex-col gap-3 border-t border-[var(--color-line)] pt-4">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Seguimiento</h3>
          <ol className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)]">
            {followUps.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">{dateTime(f.at)}</span>{" "}
                  <span className="font-medium">{CLASSIFICATION_LABELS[f.classification]}</span>
                  {f.classification === "lost_time" ? ` · ${f.lostDays} día(s)` : ""}
                  {f.note ? <span className="text-[var(--color-ink-muted)]"> · {f.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          {canManage ? (
            <Collapsible summary="Actualizar días o reclasificar">
              <FollowUpForm
                slug={slug}
                findingId={findingId}
                current={{
                  classification: fact.classification,
                  returnToWorkDate: fact.returnToWorkDate ? fact.returnToWorkDate.toISOString().slice(0, 10) : "",
                  chargePct: chargePct > 0 ? String(chargePct) : "",
                  restrictedWork: fact.restrictedWork,
                }}
              />
            </Collapsible>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <Collapsible summary="Corregir el hecho">
          <FactForm
            slug={slug}
            findingId={findingId}
            sites={sites}
            defaults={{
              siteId: fact.siteId,
              occurredAt: instantToLocalInput(fact.occurredAt),
              classification: fact.classification,
              inItinere: fact.inItinere,
              isRoad: fact.isRoad,
              employerKind: fact.employerKind,
              restrictedWork: fact.restrictedWork,
              accidentForm: fact.accidentForm,
              materialAgent: fact.materialAgent,
            }}
          />
        </Collapsible>
      ) : (
        <p className="text-sm text-[var(--color-ink-muted)]">Solo lectura: el administrador o el responsable de proceso completa y actualiza la ficha.</p>
      )}
    </SectionBlock>
  );
}
