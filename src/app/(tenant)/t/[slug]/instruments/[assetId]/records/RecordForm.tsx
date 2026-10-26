"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Button, Field, FormError, INPUT_CLASS, StatusChip } from "@/components/ui";
import { InstrumentPicker, type InstrumentOption } from "@/components/pickers/InstrumentPicker";
import { saveRecordAction, type RecordActionState } from "@/app/(tenant)/t/[slug]/instruments/actions";
import {
  POINT_REASON_LABELS,
  RECORD_KIND_LABELS,
  TRACEABILITIES,
  TRACEABILITY_LABELS,
  computeRecordOutcome,
  describeEmp,
  evaluatePoint,
  parseDecimal,
  recordWarnings,
  type Channel,
  type DecisionRule,
  type PointInput,
  type PointResult,
  type RecordKind,
  type Traceability,
} from "@/domain/calibration";
import { formatDateEs } from "@/domain/inspections/dates";

const initial: RecordActionState = {};
const checkbox = "h-4 w-4 accent-[var(--color-accent)]";
const checkRow = "flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm";

export type RowDraft = { channelKey: string; nominal: string; measured: string; uncertainty: string };

export type RecordFormInstrument = {
  code: string;
  description: string;
  criticalUse: boolean;
  decisionRule: DecisionRule;
  decisionRuleReason: string | null;
  channels: Channel[];
  requiresCalibration: boolean;
  requiresVerification: boolean;
  calibrationIntervalMonths: number | null;
  verificationIntervalMonths: number | null;
};

export type RecordFormDefaults = {
  kind: RecordKind;
  performedAt: string;
  certificateNumber: string;
  certificateIssuedAt: string;
  labName: string;
  traceability: Traceability;
  accreditationBody: string;
  accreditationNumber: string;
  accreditationScopeCovers: boolean;
  traceabilityBasis: string;
  referenceStandardAssetId: string;
  conditions: string;
  adjusted: boolean;
  basis: "points" | "certificate_statement";
  labStatement: "conforme" | "no_conforme" | "";
  labStatementSpec: string;
  labDecisionRule: string;
  coverageK: string;
  notes: string;
  asFound: RowDraft[];
  asLeft: RowDraft[];
};

const blankRow = (channelKey: string): RowDraft => ({ channelKey, nominal: "", measured: "", uncertainty: "" });
const isBlank = (r: RowDraft) => r.nominal.trim() === "" && r.measured.trim() === "" && r.uncertainty.trim() === "";
const toInput = (r: RowDraft): PointInput => ({ channelKey: r.channelKey, nominal: r.nominal, measured: r.measured, uncertainty: r.uncertainty.trim() === "" ? null : r.uncertainty });
const fmt = (v: string) => v.replace(".", ",");
const signed = (v: string) => (v.startsWith("-") ? fmt(v) : `+${fmt(v)}`);

/** Resultado de una fila, en vivo, con la misma función que usa el servidor al cerrar. */
function liveResult(rule: Exclude<DecisionRule, "certificate_statement">, channel: Channel, row: RowDraft): PointResult | null {
  if (parseDecimal(row.nominal) === null || parseDecimal(row.measured) === null) return null;
  return evaluatePoint(rule, channel, toInput(row));
}

function PointLine({ result }: { result: PointResult | null }) {
  if (!result) return <p className="text-xs text-[var(--color-ink-muted)]">Completá el valor del patrón y el medido para ver si pasa.</p>;
  if (result.incomplete) return <p className="text-xs font-medium text-[var(--color-warning)]">{POINT_REASON_LABELS[result.reason]}</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>
        Error <strong className="tabular-nums">{signed(result.error)} {result.unit}</strong>
      </span>
      <span>
        Máximo permitido <strong className="tabular-nums">±{fmt(result.emp)}</strong>
      </span>
      <StatusChip status={result.ok ? (result.reason === "in_guard_band" ? "warning" : "ok") : "danger"} label={result.ok ? "Pasa" : "No pasa"} />
      {result.reason !== "within" ? <span className="text-[var(--color-ink-muted)]">{POINT_REASON_LABELS[result.reason]}</span> : null}
    </p>
  );
}

function PointsEditor({
  title,
  hint,
  channels,
  rows,
  onChange,
  rule,
}: {
  title: string;
  hint?: string;
  channels: Channel[];
  rows: RowDraft[];
  onChange: (rows: RowDraft[]) => void;
  rule: Exclude<DecisionRule, "certificate_statement">;
}) {
  const active = channels.filter((c) => c.active);
  const update = (index: number, patch: Partial<RowDraft>) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="text-sm font-semibold">{title}</legend>
      {hint ? <p className="text-xs text-[var(--color-ink-muted)]">{hint}</p> : null}
      {active.map((channel) => {
        const own = rows.map((row, index) => ({ row, index })).filter(({ row }) => row.channelKey === channel.key);
        return (
          <div key={channel.key} className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
            <p className="text-sm">
              <span className="font-semibold">{channel.label}</span>{" "}
              <span className="text-[var(--color-ink-muted)]">
                ({channel.unit}) · error máximo {describeEmp(channel)}
                {channel.requiredPoints ? ` · al menos ${channel.requiredPoints} puntos` : ""}
              </span>
            </p>
            {own.map(({ row, index }) => (
              <div key={index} className="flex flex-col gap-2 border-t border-[var(--color-line)] pt-3 first:border-t-0 first:pt-0">
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Patrón" htmlFor={`p-${title}-${channel.key}-${index}-n`}>
                    <input id={`p-${title}-${channel.key}-${index}-n`} value={row.nominal} onChange={(e) => update(index, { nominal: e.target.value })} inputMode="decimal" autoComplete="off" className={INPUT_CLASS} />
                  </Field>
                  <Field label="Medido" htmlFor={`p-${title}-${channel.key}-${index}-m`}>
                    <input id={`p-${title}-${channel.key}-${index}-m`} value={row.measured} onChange={(e) => update(index, { measured: e.target.value })} inputMode="decimal" autoComplete="off" className={INPUT_CLASS} />
                  </Field>
                  <Field label="Incert. (U)" htmlFor={`p-${title}-${channel.key}-${index}-u`}>
                    <input id={`p-${title}-${channel.key}-${index}-u`} value={row.uncertainty} onChange={(e) => update(index, { uncertainty: e.target.value })} inputMode="decimal" autoComplete="off" className={INPUT_CLASS} />
                  </Field>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <PointLine result={liveResult(rule, channel, row)} />
                  <Button variant="ghost" onClick={() => onChange(rows.filter((_, i) => i !== index))} aria-label={`Quitar el punto ${own.findIndex((o) => o.index === index) + 1} de ${channel.label}`}>
                    Quitar
                  </Button>
                </div>
              </div>
            ))}
            <div>
              <Button variant="secondary" onClick={() => onChange([...rows, blankRow(channel.key)])}>
                Agregar un punto de {channel.label}
              </Button>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

const RESULT_TEXT = { apt: "Apto", not_apt: "No apto" } as const;

/** Formulario de carga: datos del certificado → puntos con resultado en vivo → certificado → cierre. */
export function RecordForm({
  slug,
  assetId,
  recordId,
  instrument,
  standards,
  defaults,
  today,
}: {
  slug: string;
  assetId: string;
  recordId: string | null;
  instrument: RecordFormInstrument;
  standards: InstrumentOption[];
  defaults: RecordFormDefaults;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(saveRecordAction.bind(null, slug, assetId, recordId), initial);
  const [, start] = useTransition();
  const statementOnly = instrument.decisionRule === "certificate_statement";

  const [kind, setKind] = useState<RecordKind>(defaults.kind);
  const [performedAt, setPerformedAt] = useState(defaults.performedAt);
  const [traceability, setTraceability] = useState<Traceability>(defaults.traceability);
  const [scopeCovers, setScopeCovers] = useState(defaults.accreditationScopeCovers);
  const [adjusted, setAdjusted] = useState(defaults.adjusted);
  const [basis, setBasis] = useState<"points" | "certificate_statement">(statementOnly ? "certificate_statement" : defaults.basis);
  const [labStatement, setLabStatement] = useState<"conforme" | "no_conforme" | "">(defaults.labStatement);
  const [labStatementSpec, setLabStatementSpec] = useState(defaults.labStatementSpec);
  const [labDecisionRule, setLabDecisionRule] = useState(defaults.labDecisionRule);
  const [asFound, setAsFound] = useState<RowDraft[]>(defaults.asFound);
  const [asLeft, setAsLeft] = useState<RowDraft[]>(defaults.asLeft);

  const statement = basis === "certificate_statement";
  const rule: Exclude<DecisionRule, "certificate_statement"> = instrument.decisionRule === "simple_acceptance" ? "simple_acceptance" : "guard_band";
  const kinds = ([instrument.requiresCalibration ? "calibration" : null, instrument.requiresVerification ? "verification" : null].filter(Boolean)) as RecordKind[];

  // Un canal sin filas arranca con una vacía, para que la tabla no aparezca hueca.
  const withBlankRows = (rows: RowDraft[]) => {
    const missing = instrument.channels.filter((c) => c.active && !rows.some((r) => r.channelKey === c.key));
    return missing.length === 0 ? rows : [...rows, ...missing.map((c) => blankRow(c.key))];
  };
  const foundRows = withBlankRows(asFound);
  const leftRows = withBlankRows(asLeft);

  const outcome = useMemo(
    () =>
      computeRecordOutcome({
        control: {
          decisionRule: instrument.decisionRule,
          decisionRuleReason: instrument.decisionRuleReason,
          criticalUse: instrument.criticalUse,
          channels: instrument.channels,
          calibrationIntervalMonths: instrument.calibrationIntervalMonths,
          verificationIntervalMonths: instrument.verificationIntervalMonths,
        },
        kind,
        performedAt: performedAt || today,
        basis,
        adjusted,
        asFoundPoints: statement ? [] : foundRows.filter((r) => !isBlank(r)).map(toInput),
        asLeftPoints: statement ? [] : leftRows.filter((r) => !isBlank(r)).map(toInput),
        labStatement: labStatement ? { statement: labStatement, spec: labStatementSpec, decisionRule: labDecisionRule } : null,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [instrument, kind, performedAt, basis, adjusted, statement, asFound, asLeft, labStatement, labStatementSpec, labDecisionRule, today],
  );
  const warnings = recordWarnings({ traceability, accreditationScopeCovers: scopeCovers });
  const currentRecordId = state.recordId ?? recordId ?? "";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const data = new FormData(event.currentTarget, submitter);
    start(() => formAction(data));
  };

  const pointsPayload = JSON.stringify({
    as_found: statement ? [] : foundRows.filter((r) => !isBlank(r)),
    as_left: statement || !adjusted ? [] : leftRows.filter((r) => !isBlank(r)),
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <input type="hidden" name="recordId" value={currentRecordId} />
      <input type="hidden" name="points" value={pointsPayload} />
      <input type="hidden" name="basis" value={basis} />

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm font-semibold">Datos del certificado</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {kinds.length > 1 ? (
            <Field label="Tipo" required>
              <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as RecordKind)} className={INPUT_CLASS}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {RECORD_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <input type="hidden" name="kind" value={kind} />
          )}
          <Field label="Fecha en que se calibró" required hint="La del servicio, no la de emisión del certificado: de acá corre la vigencia.">
            <input name="performedAt" type="date" required max={today} value={performedAt} onChange={(e) => setPerformedAt(e.target.value)} className={INPUT_CLASS} />
          </Field>
          <Field label="N.º de certificado" hint="Opcional.">
            <input name="certificateNumber" defaultValue={defaults.certificateNumber} maxLength={80} className={INPUT_CLASS} />
          </Field>
          <Field label="Fecha de emisión del certificado" hint="Opcional.">
            <input name="certificateIssuedAt" type="date" max={today} defaultValue={defaults.certificateIssuedAt} className={INPUT_CLASS} />
          </Field>
          <Field label={traceability === "in_house" ? "Quién verificó" : "Laboratorio"} required>
            <input name="labName" required minLength={2} defaultValue={defaults.labName} maxLength={120} placeholder={traceability === "in_house" ? "Ej.: Calidad" : "Ej.: INTI"} className={INPUT_CLASS} />
          </Field>
          <Field label="Trazabilidad" required hint="Contra qué patrones se calibró.">
            <select name="traceability" value={traceability} onChange={(e) => setTraceability(e.target.value as Traceability)} className={INPUT_CLASS}>
              {TRACEABILITIES.map((t) => (
                <option key={t} value={t}>
                  {TRACEABILITY_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {traceability === "accredited_lab" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organismo que acredita" required hint="Ej.: OAA.">
              <input name="accreditationBody" defaultValue={defaults.accreditationBody} maxLength={80} className={INPUT_CLASS} />
            </Field>
            <Field label="N.º de acreditación" required>
              <input name="accreditationNumber" defaultValue={defaults.accreditationNumber} maxLength={80} className={INPUT_CLASS} />
            </Field>
            <label className={`${checkRow} sm:col-span-2`}>
              <input type="checkbox" name="accreditationScopeCovers" checked={scopeCovers} onChange={(e) => setScopeCovers(e.target.checked)} className={checkbox} />
              <span>El alcance de la acreditación cubre este servicio</span>
            </label>
          </div>
        ) : null}
        {traceability === "other_lab" ? (
          <Field label="Cómo se asegura la trazabilidad" required hint="Un auditor va a preguntar. Ej.: usa patrones calibrados por el INTI, certificado adjunto.">
            <textarea name="traceabilityBasis" rows={2} defaultValue={defaults.traceabilityBasis} maxLength={500} className={INPUT_CLASS} />
          </Field>
        ) : null}
        {traceability === "in_house" ? (
          <InstrumentPicker
            instruments={standards}
            name="referenceStandardAssetId"
            label="Equipo patrón"
            required
            defaultValue={defaults.referenceStandardAssetId}
            hint="Debe tener una calibración vigente a la fecha de la verificación."
          />
        ) : null}
        {warnings.map((w) => (
          <p key={w} role="note" className="rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-3 py-2 text-sm">
            {w}
          </p>
        ))}
        <Field label="Condiciones ambientales" hint="Opcional. Temperatura, humedad.">
          <input name="conditions" defaultValue={defaults.conditions} maxLength={200} className={INPUT_CLASS} />
        </Field>
      </fieldset>

      {statementOnly ? (
        <p className="text-sm text-[var(--color-ink-muted)]">Este equipo se acepta por lo que declara el laboratorio: no se cargan puntos.</p>
      ) : (
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="text-sm font-semibold">Qué informa el certificado</legend>
          <label className={checkRow}>
            <input type="radio" name="basisChoice" checked={!statement} onChange={() => setBasis("points")} className={checkbox} />
            <span>Los puntos medidos (error por punto)</span>
          </label>
          <label className={checkRow}>
            <input type="radio" name="basisChoice" checked={statement} onChange={() => setBasis("certificate_statement")} className={checkbox} />
            <span>Solo dice «conforme» o «no conforme»</span>
          </label>
        </fieldset>
      )}

      {statement ? (
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="text-sm font-semibold">Declaración del laboratorio</legend>
          <Field label="El certificado declara" required>
            <select name="labStatement" value={labStatement} onChange={(e) => setLabStatement(e.target.value as typeof labStatement)} className={INPUT_CLASS}>
              <option value="">Elegí</option>
              <option value="conforme">Conforme</option>
              <option value="no_conforme">No conforme</option>
            </select>
          </Field>
          <Field label="Especificación contra la que declara" required hint="Ej.: manual del fabricante, ±10 % de la lectura.">
            <input name="labStatementSpec" value={labStatementSpec} onChange={(e) => setLabStatementSpec(e.target.value)} maxLength={300} className={INPUT_CLASS} />
          </Field>
          <Field label="Regla de decisión del laboratorio" required hint="Ej.: aceptación simple, banda de guarda. Sin esto la declaración no es comparable.">
            <input name="labDecisionRule" value={labDecisionRule} onChange={(e) => setLabDecisionRule(e.target.value)} maxLength={300} className={INPUT_CLASS} />
          </Field>
        </fieldset>
      ) : (
        <>
          <label className={checkRow}>
            <input type="checkbox" name="adjusted" checked={adjusted} onChange={(e) => setAdjusted(e.target.checked)} className={checkbox} />
            <span>Se ajustó el equipo durante el servicio</span>
          </label>
          <Field label="Factor de cobertura (k)" hint="Casi siempre 2. Es el de las incertidumbres que informa el certificado.">
            <input name="coverageK" defaultValue={defaults.coverageK} inputMode="decimal" className={`${INPUT_CLASS} sm:max-w-40`} />
          </Field>
          <PointsEditor
            title={adjusted ? "Antes del ajuste (como llegó)" : "Puntos medidos"}
            hint={adjusted ? "Si el certificado no trae estos datos, dejalo vacío: el resultado de antes queda «no evaluado»." : "El error es medido − patrón. La incertidumbre U es la expandida que informa el certificado."}
            channels={instrument.channels}
            rows={foundRows}
            onChange={setAsFound}
            rule={rule}
          />
          {adjusted ? <PointsEditor title="Después del ajuste (como se entregó)" hint="Con estos puntos se decide si el equipo vuelve a servir." channels={instrument.channels} rows={leftRows} onChange={setAsLeft} rule={rule} /> : null}
        </>
      )}

      <section aria-label="Resultado calculado" className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] p-4">
        <p className="font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.06em] text-[var(--color-ink-muted)]">Resultado calculado</p>
        {outcome.complete && outcome.asLeftResult ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-base font-semibold">
              <StatusChip status={outcome.asLeftResult === "apt" ? "ok" : "danger"} label={RESULT_TEXT[outcome.asLeftResult]} />
              {outcome.asLeftResult === "apt"
                ? outcome.validUntil
                  ? `Vigente hasta el ${formatDateEs(outcome.validUntil)}`
                  : "Apto, pero el equipo no tiene intervalo definido: no queda vigencia"
                : "El equipo no se puede usar hasta una nueva calibración"}
            </p>
            {adjusted && !statement ? (
              <p className="text-sm">
                Al recibirlo:{" "}
                <strong>{outcome.asFoundResult === "not_evaluated" ? "no evaluado (sin datos de antes)" : outcome.asFoundResult === "apt" ? "estaba dentro de tolerancia" : "estaba fuera de tolerancia"}</strong>
                {outcome.asFoundResult === "not_apt" || (outcome.asFoundResult === "not_evaluated" && instrument.criticalUse)
                  ? ". Se va a pedir una evaluación de impacto de las mediciones hechas con el equipo."
                  : "."}
              </p>
            ) : outcome.asLeftResult === "not_apt" ? (
              <p className="text-sm">Se va a pedir una evaluación de impacto de las mediciones hechas con el equipo.</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Todavía no se puede calcular. Falta:</p>
            <ul className="list-disc pl-5 text-sm">
              {[...new Set(outcome.incompleteReasons.map((r) => r.message))].slice(0, 6).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </>
        )}
        {outcome.ruleReasonApplied && statement ? <p className="text-xs text-[var(--color-ink-muted)]">{outcome.ruleReasonApplied}</p> : null}
      </section>

      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="text-sm font-semibold">Certificado</legend>
        <Field
          label="Adjuntar el certificado (PDF o imagen)"
          hint={traceability === "in_house" ? "Opcional en una verificación interna." : "Obligatorio para cerrar. Si todavía no lo tenés, guardá el borrador y adjuntalo después."}
        >
          <input name="certificate" type="file" multiple accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" className={INPUT_CLASS} />
        </Field>
        <Field label="Observaciones" hint="Opcional.">
          <textarea name="notes" rows={2} defaultValue={defaults.notes} maxLength={1000} className={INPUT_CLASS} />
        </Field>
      </fieldset>

      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" name="intent" value="close" disabled={pending || !outcome.complete}>
          {pending ? "Guardando…" : "Cerrar y guardar resultado"}
        </Button>
        <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>
          Guardar borrador
        </Button>
      </div>
      {outcome.complete ? null : <p className="text-xs text-[var(--color-ink-muted)]">Para cerrar tienen que estar todos los datos. Mientras tanto podés guardar el borrador.</p>}
    </form>
  );
}
