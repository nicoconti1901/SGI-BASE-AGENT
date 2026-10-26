import type { InstrumentControl } from "@prisma/client";
import type { Channel } from "@/domain/calibration";
import type { RecordFormInstrument } from "@/app/(tenant)/t/[slug]/instruments/[assetId]/records/RecordForm";

/** Lo que el formulario de carga necesita del equipo, en datos simples para el cliente. */
export function instrumentFormProps(asset: { code: string; description: string }, control: InstrumentControl, channels: Channel[]): RecordFormInstrument {
  return {
    code: asset.code,
    description: asset.description,
    criticalUse: control.criticalUse,
    decisionRule: control.decisionRule,
    decisionRuleReason: control.decisionRuleReason,
    channels,
    requiresCalibration: control.requiresCalibration,
    requiresVerification: control.requiresVerification,
    calibrationIntervalMonths: control.calibrationIntervalMonths,
    verificationIntervalMonths: control.verificationIntervalMonths,
  };
}
