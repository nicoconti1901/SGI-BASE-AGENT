"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormError, INPUT_CLASS } from "@/components/ui";
import { SitePicker } from "@/components/pickers/SitePicker";
import { PersonPicker } from "@/components/pickers/PersonPicker";
import { useKeepInputs } from "@/lib/use-keep-inputs";
import { saveInstrumentAction, type InstrumentActionState } from "@/app/(tenant)/t/[slug]/instruments/actions";
import { DECISION_RULES, DECISION_RULE_LABELS, MAGNITUDES, MAGNITUDE_DEFS, type DecisionRule, type Magnitude } from "@/domain/calibration/types";

const initial: InstrumentActionState = {};

export type ChannelDraft = {
  key: string;
  label: string;
  unit: string;
  rangeMin: string;
  rangeMax: string;
  resolution: string;
  emp: { abs: string; pctReading: string; pctFullScale: string };
  requiredPoints: string;
  active: boolean;
};

export type InstrumentDefaults = {
  id: string;
  code: string;
  description: string;
  siteId: string;
  sector: string | null;
  assignedPerson: { id: string; name: string; employeeCode: string; siteName: string } | null;
  brand: string;
  model: string;
  serialNumber: string;
  inServiceSince: string;
  magnitude: Magnitude;
  isReferenceStandard: boolean;
  criticalUse: boolean;
  criticalUseReason: string;
  requiresCalibration: boolean;
  calibrationIntervalMonths: string;
  requiresVerification: boolean;
  verificationIntervalMonths: string;
  intervalReason: string;
  noControlReason: string;
  decisionRule: DecisionRule;
  decisionRuleReason: string;
  alertLeadDays: string;
  channels: ChannelDraft[];
};

const blankChannel = (): ChannelDraft => ({
  key: "",
  label: "",
  unit: "",
  rangeMin: "0",
  rangeMax: "",
  resolution: "",
  emp: { abs: "", pctReading: "", pctFullScale: "" },
  requiredPoints: "",
  active: true,
});

const slugKey = (label: string) =>
  label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);

const checkbox = "h-4 w-4 accent-[var(--color-accent)]";
const checkRow = "flex min-h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] px-3 py-2 text-sm";

function ChannelRow({ channel, onChange, onRemove, index }: { channel: ChannelDraft; onChange: (c: ChannelDraft) => void; onRemove: () => void; index: number }) {
  const set = (patch: Partial<ChannelDraft>) => onChange({ ...channel, ...patch });
  const setEmp = (patch: Partial<ChannelDraft["emp"]>) => onChange({ ...channel, emp: { ...channel.emp, ...patch } });
  const n = index + 1;
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] p-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label={`Canal ${n}: nombre`} required hint="Ej.: H₂S, Presión, Temperatura.">
          <input
            value={channel.label}
            onChange={(e) => set({ label: e.target.value, key: channel.key === "" || channel.key === slugKey(channel.label) ? slugKey(e.target.value) : channel.key })}
            maxLength={60}
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Clave" hint="Se arma sola. Minúsculas y guion bajo.">
          <input value={channel.key} onChange={(e) => set({ key: e.target.value })} maxLength={30} className={INPUT_CLASS} />
        </Field>
        <Field label="Unidad" required>
          <input value={channel.unit} onChange={(e) => set({ unit: e.target.value })} maxLength={20} placeholder="ppm, bar, °C…" className={INPUT_CLASS} />
        </Field>
        <Field label="Puntos mínimos" hint="Opcional.">
          <input value={channel.requiredPoints} onChange={(e) => set({ requiredPoints: e.target.value })} inputMode="numeric" className={INPUT_CLASS} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Rango: desde" required>
          <input value={channel.rangeMin} onChange={(e) => set({ rangeMin: e.target.value })} inputMode="decimal" className={INPUT_CLASS} />
        </Field>
        <Field label="Rango: hasta" required>
          <input value={channel.rangeMax} onChange={(e) => set({ rangeMax: e.target.value })} inputMode="decimal" className={INPUT_CLASS} />
        </Field>
        <Field label="Resolución" hint="Opcional.">
          <input value={channel.resolution} onChange={(e) => set({ resolution: e.target.value })} inputMode="decimal" className={INPUT_CLASS} />
        </Field>
        <label className={`${checkRow} self-end`}>
          <input type="checkbox" checked={channel.active} onChange={(e) => set({ active: e.target.checked })} className={checkbox} />
          <span>Canal activo</span>
        </label>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold">Error máximo permitido (EMP)</legend>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Lo fija tu uso del equipo (o el manual del fabricante). Se suma: valor fijo + % de la lectura + % del fondo de escala. Completá al menos uno.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={`Valor fijo${channel.unit ? ` (${channel.unit})` : ""}`}>
            <input value={channel.emp.abs} onChange={(e) => setEmp({ abs: e.target.value })} inputMode="decimal" className={INPUT_CLASS} />
          </Field>
          <Field label="% de la lectura">
            <input value={channel.emp.pctReading} onChange={(e) => setEmp({ pctReading: e.target.value })} inputMode="decimal" className={INPUT_CLASS} />
          </Field>
          <Field label="% del fondo de escala">
            <input value={channel.emp.pctFullScale} onChange={(e) => setEmp({ pctFullScale: e.target.value })} inputMode="decimal" className={INPUT_CLASS} />
          </Field>
        </div>
      </fieldset>
      <div>
        <Button variant="ghost" onClick={onRemove}>
          Quitar el canal {n}
        </Button>
      </div>
    </div>
  );
}

/** Alta (sin `instrument`) o edición de un equipo de medición con su control metrológico. */
export function InstrumentForm({
  slug,
  sites,
  instrument,
}: {
  slug: string;
  sites: { id: string; name: string }[];
  instrument?: InstrumentDefaults;
}) {
  const action = saveInstrumentAction.bind(null, slug, instrument?.id ?? null);
  const [state, formAction, pending] = useActionState(action, initial);
  const keep = useKeepInputs(formAction, state);

  const [magnitude, setMagnitude] = useState<Magnitude>(instrument?.magnitude ?? "other");
  const [requiresCalibration, setRequiresCalibration] = useState(instrument?.requiresCalibration ?? true);
  const [requiresVerification, setRequiresVerification] = useState(instrument?.requiresVerification ?? false);
  const [calMonths, setCalMonths] = useState(instrument?.calibrationIntervalMonths ?? String(MAGNITUDE_DEFS.other.calibrationMonths));
  const [calTouched, setCalTouched] = useState(Boolean(instrument));
  const [intervalReason, setIntervalReason] = useState(instrument?.intervalReason ?? "");
  const [criticalUse, setCriticalUse] = useState(instrument?.criticalUse ?? false);
  const [rule, setRule] = useState<DecisionRule>(instrument?.decisionRule ?? "guard_band");
  const [channels, setChannels] = useState<ChannelDraft[]>(instrument?.channels ?? [blankChannel()]);

  const pickMagnitude = (value: Magnitude) => {
    setMagnitude(value);
    if (!calTouched) {
      setCalMonths(String(MAGNITUDE_DEFS[value].calibrationMonths));
      setIntervalReason(MAGNITUDE_DEFS[value].intervalReason);
    }
  };
  const controlled = requiresCalibration || requiresVerification;

  return (
    <form {...keep} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">El equipo</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {instrument ? null : (
            <Field label="Código" required hint="Único en la empresa; se guarda en mayúsculas. Ej.: DET-007 (como figura en la etiqueta).">
              <input name="code" required maxLength={30} placeholder="Ej.: DET-007" className={INPUT_CLASS} />
            </Field>
          )}
          <Field label="Descripción" required hint="Qué es y dónde se usa.">
            <input name="description" required minLength={2} defaultValue={instrument?.description} placeholder="Ej.: Detector multigás de cuadrilla de mantenimiento" className={INPUT_CLASS} />
          </Field>
          <SitePicker sites={sites} name="siteId" label="Sede" required defaultValue={instrument?.siteId ?? ""} />
          <Field label="Sector" hint="Opcional.">
            <input name="sector" defaultValue={instrument?.sector ?? ""} className={INPUT_CLASS} />
          </Field>
          <Field label="Marca">
            <input name="brand" defaultValue={instrument?.brand ?? ""} maxLength={80} className={INPUT_CLASS} />
          </Field>
          <Field label="Modelo">
            <input name="model" defaultValue={instrument?.model ?? ""} maxLength={80} className={INPUT_CLASS} />
          </Field>
          <Field label="N.º de serie">
            <input name="serialNumber" defaultValue={instrument?.serialNumber ?? ""} maxLength={80} className={INPUT_CLASS} />
          </Field>
          <Field label="En uso desde" hint="Opcional.">
            <input name="inServiceSince" type="date" defaultValue={instrument?.inServiceSince ?? ""} className={INPUT_CLASS} />
          </Field>
          <PersonPicker slug={slug} name="assignedPersonId" label="Responsable" hint="Opcional. Recibe los avisos de vencimiento si tiene usuario." defaultPerson={instrument?.assignedPerson ?? null} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold">Control metrológico</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Magnitud" required>
            <select name="magnitude" value={magnitude} onChange={(e) => pickMagnitude(e.target.value as Magnitude)} className={INPUT_CLASS}>
              {MAGNITUDES.map((m) => (
                <option key={m} value={m}>
                  {MAGNITUDE_DEFS[m].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Aviso previo (días)" hint="Cuántos días antes del vencimiento aparece «Por vencer». Para dar tiempo al laboratorio.">
            <input name="alertLeadDays" type="number" min={0} max={365} defaultValue={instrument?.alertLeadDays ?? "30"} className={INPUT_CLASS} />
          </Field>
          <label className={checkRow}>
            <input type="checkbox" name="criticalUse" checked={criticalUse} onChange={(e) => setCriticalUse(e.target.checked)} className={checkbox} />
            <span>Uso crítico (decide seguridad o calidad)</span>
          </label>
          <label className={checkRow}>
            <input type="checkbox" name="isReferenceStandard" defaultChecked={instrument?.isReferenceStandard} className={checkbox} />
            <span>Es un patrón de trabajo (se usa para verificar otros equipos)</span>
          </label>
        </div>
        {criticalUse ? (
          <Field label="Por qué es de uso crítico" required>
            <input name="criticalUseReason" required defaultValue={instrument?.criticalUseReason ?? ""} placeholder="Ej.: autoriza el ingreso a espacios confinados" className={INPUT_CLASS} />
          </Field>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className={checkRow}>
            <input type="checkbox" name="requiresCalibration" checked={requiresCalibration} onChange={(e) => setRequiresCalibration(e.target.checked)} className={checkbox} />
            <span>Se calibra en un laboratorio</span>
          </label>
          {requiresCalibration ? (
            <Field label="Calibrar cada (meses)" required hint={MAGNITUDE_DEFS[magnitude].intervalReason}>
              <input
                name="calibrationIntervalMonths"
                type="number"
                min={1}
                max={120}
                required
                value={calMonths}
                onChange={(e) => {
                  setCalTouched(true);
                  setCalMonths(e.target.value);
                }}
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}
          <label className={checkRow}>
            <input type="checkbox" name="requiresVerification" checked={requiresVerification} onChange={(e) => setRequiresVerification(e.target.checked)} className={checkbox} />
            <span>Se verifica internamente contra un patrón</span>
          </label>
          {requiresVerification ? (
            <Field label="Verificar cada (meses)" required>
              <input name="verificationIntervalMonths" type="number" min={1} max={120} required defaultValue={instrument?.verificationIntervalMonths ?? "3"} className={INPUT_CLASS} />
            </Field>
          ) : null}
        </div>
        {controlled ? (
          <Field key="interval-reason" label="Motivo del intervalo" hint="Opcional. Un auditor suele preguntar por qué ese plazo.">
            <input name="intervalReason" value={intervalReason} onChange={(e) => setIntervalReason(e.target.value)} maxLength={300} className={INPUT_CLASS} />
          </Field>
        ) : (
          <Field key="no-control-reason" label="Por qué no se calibra ni se verifica" required hint="Queda como «sin control metrológico». Ej.: indicativo, no se usa para decidir.">
            <input name="noControlReason" required defaultValue={instrument?.noControlReason ?? ""} maxLength={300} className={INPUT_CLASS} />
          </Field>
        )}
      </fieldset>

      {controlled ? (
        <>
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold">Cuándo el equipo es apto</legend>
            <Field label="Regla de decisión" required>
              <select name="decisionRule" value={rule} onChange={(e) => setRule(e.target.value as DecisionRule)} className={INPUT_CLASS}>
                {DECISION_RULES.map((r) => (
                  <option key={r} value={r}>
                    {DECISION_RULE_LABELS[r]}
                    {r === "guard_band" ? " (recomendada)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {rule !== "guard_band" ? (
              <Field label="Por qué no usás la regla recomendada" required>
                <input name="decisionRuleReason" required defaultValue={instrument?.decisionRuleReason ?? ""} maxLength={300} className={INPUT_CLASS} />
              </Field>
            ) : (
              <p className="text-xs text-[var(--color-ink-muted)]">Apto si el error más la incertidumbre no superan el error máximo permitido en ningún punto.</p>
            )}
          </fieldset>

          {rule !== "certificate_statement" ? (
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold">Canales</legend>
              <p className="text-xs text-[var(--color-ink-muted)]">
                Cada sensor o magnitud que se mide. Un detector multigás tiene un canal por gas; un manómetro, uno solo.
              </p>
              {channels.map((c, i) => (
                <ChannelRow
                  key={i}
                  index={i}
                  channel={c}
                  onChange={(next) => setChannels(channels.map((x, j) => (j === i ? next : x)))}
                  onRemove={() => setChannels(channels.filter((_, j) => j !== i))}
                />
              ))}
              <div>
                <Button variant="secondary" onClick={() => setChannels([...channels, blankChannel()])}>
                  Agregar un canal
                </Button>
              </div>
            </fieldset>
          ) : null}
        </>
      ) : null}
      <input type="hidden" name="channels" value={JSON.stringify(controlled ? channels.map(toChannelPayload) : [])} />

      {state.error ? <FormError>{state.error}</FormError> : null}
      {state.ok ? (
        <p role="status" className="text-sm text-[var(--color-success)]">
          {state.ok}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Guardando…" : instrument ? "Guardar cambios" : "Registrar equipo"}
        </Button>
      </div>
    </form>
  );
}

/** Lo que viaja al servidor: números como texto (el servidor los lee con coma o punto) y vacíos omitidos. */
function toChannelPayload(c: ChannelDraft) {
  const required = c.requiredPoints.trim();
  const resolution = c.resolution.trim();
  return {
    key: c.key.trim(),
    label: c.label.trim(),
    unit: c.unit.trim(),
    rangeMin: c.rangeMin.trim(),
    rangeMax: c.rangeMax.trim(),
    ...(resolution ? { resolution } : {}),
    emp: { abs: c.emp.abs.trim() || "0", pctReading: c.emp.pctReading.trim() || "0", pctFullScale: c.emp.pctFullScale.trim() || "0" },
    ...(required ? { requiredPoints: Number(required) } : {}),
    active: c.active,
  };
}
