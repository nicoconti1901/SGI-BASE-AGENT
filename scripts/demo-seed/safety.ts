import {
  addIncidentFollowUp,
  createIncidentWithFinding,
  saveIncidentHealth,
  updateSafetySettings,
  type IncidentFactInput,
  type SafetyUser,
} from "../../src/lib/safety-stats";
import { saveExposure, syncExposureDueItems } from "../../src/lib/safety-exposure";
import { publishSpec, type MeasureSpec } from "./findings";
import { db, step, type DemoTenant } from "./kit";

const DAY = 24 * 60 * 60 * 1000;
const isoOf = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);
const dayAfter = (date: Date, days: number) => isoOf(new Date(date.getTime() + days * DAY));

/** Horas y dotación por sede y grupo: la dotación es la base, las horas salen de ella con un factor mensual. */
const EXPOSURE_BASE: { site: string; own?: number; contractor?: number }[] = [
  { site: "Oficina Neuquén", own: 12 },
  { site: "Base Añelo", own: 28, contractor: 8 },
  { site: "Obra Loma Campana", own: 40, contractor: 35 },
  { site: "Planta Centenario", own: 32, contractor: 6 },
  { site: "Campamento Sauzal", own: 10, contractor: 4 },
];

function lastMonths(count: number): string[] {
  const now = new Date();
  const out: string[] = [];
  for (let i = count; i >= 1; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

async function exposure(t: DemoTenant, actor: SafetyUser) {
  const months = lastMonths(12);
  for (const [mi, month] of months.entries()) {
    for (const row of EXPOSURE_BASE) {
      // Huecos a propósito: el campamento no tiene cargado el último mes, para probar los avisos de exposición faltante.
      if (row.site === "Campamento Sauzal" && mi >= months.length - 1) continue;
      const factor = 0.9 + ((mi * 7 + row.site.length) % 5) * 0.04;
      const cell = (heads: number) => ({ headcountAvg: heads + (mi % 3), hours: Math.round((heads + (mi % 3)) * 176 * factor) });
      await step(`Exposición ${row.site} ${month}`, () =>
        saveExposure({
          tenantId: t.id,
          actor,
          siteId: t.siteIds[row.site],
          month,
          ...(row.own ? { own: cell(row.own) } : {}),
          ...(row.contractor ? { contractor: cell(row.contractor) } : {}),
        }),
      );
    }
  }
}

type Incident = {
  title: string;
  description: string;
  daysAgo: number;
  site: string;
  classification: IncidentFactInput["classification"];
  employer?: "own" | "contractor";
  inItinere?: boolean;
  road?: boolean;
  restricted?: boolean;
  form: string;
  agent: string;
  /** Días de baja hasta el reintegro; sin dato = caso abierto. */
  lostDays?: number;
  person?: string;
  injury?: string;
  body?: string;
  art?: string;
  /** Lo registra un colaborador, sin la ficha de salud (queda pendiente). */
  withoutHealth?: boolean;
  publish?: { measures: MeasureSpec[]; whys: string[] };
};

const INCIDENTS: Incident[] = [
  {
    title: "Caída desde andamio durante el montaje", description: "Un operario cayó desde 1,8 m al retirar una plataforma del andamio y se lastimó la muñeca.",
    daysAgo: 320, site: "Obra Loma Campana", classification: "lost_time", form: "fall_height", agent: "scaffold", lostDays: 14, person: "L-015", injury: "fracture", body: "hand", art: "ART-2025-118820",
    publish: { whys: ["La plataforma no estaba trabada.", "No se hizo la verificación previa del andamio.", "El procedimiento de armado no exige el chequeo firmado."], measures: [{ kind: "corrective", title: "Verificar y trabar todas las plataformas del andamio", owner: "inspector", dueIn: -280 }, { kind: "preventive", title: "Incluir el chequeo firmado en el procedimiento de armado", owner: "hse", dueIn: -250, linkedRootCause: true }] },
  },
  { title: "Corte en la mano con amoladora", description: "Corte superficial en la mano izquierda al cambiar el disco de una amoladora.", daysAgo: 280, site: "Planta Centenario", classification: "first_aid", form: "cut", agent: "hand_tool", person: "L-010", injury: "wound", body: "hand" },
  { title: "Caída de una herramienta desde altura (casi accidente)", description: "Una llave cayó desde una plataforma a dos metros de un operario; no hubo lesionados.", daysAgo: 250, site: "Base Añelo", classification: "near_miss", form: "struck_by_object", agent: "load_material" },
  {
    title: "Atrapamiento de mano en un equipo", description: "Un operario contratista se atrapó la mano entre el brazo del equipo y la estructura.", daysAgo: 215, site: "Obra Loma Campana", classification: "lost_time", employer: "contractor", form: "caught", agent: "machinery", lostDays: 30, person: "C-101", injury: "fracture", body: "fingers", art: "ART-2025-204411",
    publish: { whys: ["No se bloqueó el equipo antes de intervenir.", "No se aplicó el procedimiento de bloqueo y etiquetado.", "El contratista no recibió la capacitación de bloqueo y etiquetado."], measures: [{ kind: "corrective", title: "Capacitar a los contratistas en bloqueo y etiquetado", owner: "hse", dueIn: -150 }] },
  },
  { title: "Dolor lumbar por levantamiento manual de cargas", description: "El operario continuó con tareas livianas tras el dolor al levantar bolsas de cemento.", daysAgo: 190, site: "Planta Centenario", classification: "no_lost_time", restricted: true, form: "overexertion", agent: "load_material", person: "L-016", injury: "back_injury", body: "back", art: "ART-2025-330982" },
  {
    title: "Choque en el trayecto al trabajo", description: "El chofer chocó con su auto particular camino a la base, con lesiones en la rodilla.", daysAgo: 160, site: "Base Añelo", classification: "lost_time", inItinere: true, road: true, form: "traffic", agent: "vehicle", lostDays: 9, person: "L-011", injury: "sprain", body: "knee", art: "ART-2025-401177",
  },
  { title: "Tropiezo en escalera de acceso (casi accidente)", description: "Un contratista tropezó en un escalón sin antideslizante; sin lesiones.", daysAgo: 130, site: "Obra Loma Campana", classification: "near_miss", employer: "contractor", form: "fall_same_level", agent: "floor_stairs" },
  { title: "Quemadura leve en el comedor", description: "Quemadura leve en el antebrazo con agua caliente en el comedor del campamento.", daysAgo: 100, site: "Campamento Sauzal", classification: "first_aid", form: "contact_heat_cold", agent: "other", person: "L-005", injury: "burn", body: "shoulder_arm", withoutHealth: true },
  {
    title: "Salpicadura de producto químico en los ojos", description: "Salpicadura al trasvasar un producto de limpieza sin protección facial.", daysAgo: 75, site: "Planta Centenario", classification: "lost_time", form: "contact_substance", agent: "chemical", lostDays: 21, person: "L-010", injury: "poisoning", body: "eyes", art: "ART-2026-009443",
    publish: { whys: ["No se usó protección facial.", "El pañol no entrega antiparras de seguridad con el producto.", "La hoja de seguridad no está en el puesto de trasvase."], measures: [{ kind: "corrective", title: "Instalar lavaojos y proveer protección facial en el sector", owner: "operaciones", dueIn: -40 }, { kind: "preventive", title: "Colocar las hojas de seguridad en cada puesto de trasvase", owner: "calidad", dueIn: 5, linkedRootCause: true }] },
  },
  { title: "Golpe contra estructura metálica", description: "Golpe en la cabeza contra una viga baja; el operario usaba casco.", daysAgo: 55, site: "Obra Loma Campana", classification: "no_lost_time", form: "struck_against", agent: "environment", person: "L-017", injury: "contusion", body: "head", art: "ART-2026-120077" },
  { title: "Maniobra brusca de camioneta (casi accidente)", description: "La camioneta frenó a tiempo ante un animal en la ruta; sin daños.", daysAgo: 40, site: "Base Añelo", classification: "near_miss", road: true, form: "traffic", agent: "vehicle" },
  {
    title: "Caída desde plataforma de andamio (contratista)", description: "Un operario contratista cayó de una plataforma a 1,5 m. Continúa en reposo.", daysAgo: 28, site: "Obra Loma Campana", classification: "lost_time", employer: "contractor", form: "fall_height", agent: "scaffold", person: "C-102", injury: "fracture", body: "foot", art: "ART-2026-188120",
    publish: { whys: ["El andamio no tenía baranda completa.", "El supervisor habilitó el andamio sin la inspección diaria.", "La inspección diaria no se exige a los contratistas."], measures: [{ kind: "corrective", title: "Completar barandas y rodapiés en todos los andamios", owner: "inspector", dueIn: 4 }, { kind: "preventive", title: "Exigir la inspección diaria firmada a los contratistas", owner: "hse", dueIn: 30, linkedRootCause: true }] },
  },
  { title: "Corte superficial con cuchilla", description: "Corte leve en el dedo al abrir una caja con cuchilla.", daysAgo: 14, site: "Planta Centenario", classification: "first_aid", form: "cut", agent: "hand_tool", person: "L-005", injury: "wound", body: "fingers", withoutHealth: true },
  { title: "Esguince de tobillo en el playón", description: "El operario torció el tobillo al descender de la máquina. Continúa en reposo.", daysAgo: 6, site: "Obra Loma Campana", classification: "lost_time", form: "fall_same_level", agent: "machinery", person: "L-019", injury: "sprain", body: "foot", art: "ART-2026-251090" },
  { title: "Derrame de gasoil contenido (casi accidente)", description: "Se derramaron unos litros de gasoil en la base y se contuvo con material absorbente.", daysAgo: 3, site: "Base Añelo", classification: "near_miss", form: "other", agent: "environment" },
];

export async function seedSafetyModule(t: DemoTenant) {
  const hse: SafetyUser = { userId: t.users.hse.userId, role: "process_owner", isPlatformSuperuser: false };
  const reporter: SafetyUser = { userId: t.users.inspector.userId, role: "contributor", isPlatformSuperuser: false };
  const admin: SafetyUser = { userId: t.users.admin.userId, role: "tenant_admin", isPlatformSuperuser: false };

  await step("Ajustes de accidentabilidad", () => updateSafetySettings({ tenantId: t.id, actor: admin, settings: { exposureOwnerUserId: t.users.hse.userId } }));
  await exposure(t, hse);

  const personId = (code?: string) => (code ? (t.people.find((p) => p.code === code)?.id ?? null) : null);
  const created: { findingId: string; incident: Incident }[] = [];

  for (const inc of INCIDENTS) {
    await step(`Accidente «${inc.title}»`, async () => {
      const occurredAt = daysAgo(inc.daysAgo);
      const returnTo = inc.classification === "lost_time" && inc.lostDays ? dayAfter(occurredAt, inc.lostDays) : null;
      const actor = inc.withoutHealth ? reporter : hse;
      const result = await createIncidentWithFinding({
        tenantId: t.id,
        actor,
        title: inc.title,
        description: inc.description,
        fact: {
          siteId: t.siteIds[inc.site],
          occurredAt,
          classification: inc.classification,
          inItinere: inc.inItinere ?? false,
          isRoad: inc.road ?? false,
          employerKind: inc.employer ?? "own",
          restrictedWork: inc.restricted ?? false,
          accidentForm: inc.form,
          materialAgent: inc.agent,
          returnToWorkDate: returnTo,
        },
        health: inc.withoutHealth || inc.classification === "near_miss"
          ? null
          : { affectedPersonId: personId(inc.person), natureOfInjury: inc.injury ?? null, bodyPart: inc.body ?? null, artClaimNumber: inc.art ?? null, deathDate: null },
      });
      created.push({ findingId: result.finding.id, incident: inc });
    });
  }

  // Un caso abierto (sin fecha de reintegro) que se actualiza con un seguimiento, y una ficha completada después del alta.
  await step("Seguimiento del caso abierto de andamio", async () => {
    const open = created.find((c) => c.incident.title.startsWith("Caída desde plataforma"));
    if (!open) throw new Error("No se creó el caso");
    await addIncidentFollowUp({
      tenantId: t.id, actor: hse, findingId: open.findingId,
      followUp: { classification: "lost_time", restrictedWork: false, returnToWorkDate: null, chargePct: null, note: "Continúa en reposo por indicación médica; control en 15 días." },
    });
  });
  await step("Ficha de salud completada después del alta (quemadura leve)", async () => {
    const pending = created.find((c) => c.incident.title.startsWith("Quemadura leve"));
    if (!pending) throw new Error("No se creó el caso");
    await saveIncidentHealth({
      tenantId: t.id, actor: hse, findingId: pending.findingId,
      health: { affectedPersonId: personId("L-005"), natureOfInjury: "burn", bodyPart: "shoulder_arm", artClaimNumber: null, deathDate: null },
    });
  });

  // Publicar con causa raíz y medidas los hallazgos de los accidentes más graves.
  for (const c of created.filter((x) => x.incident.publish)) {
    await step(`Publicar el hallazgo del accidente «${c.incident.title}»`, async () => {
      const finding = await db.finding.findUniqueOrThrow({ where: { id: c.findingId } });
      await publishSpec(t, finding, { type: "incident", whys: c.incident.publish!.whys, measures: c.incident.publish!.measures, severity: "Alta", location: c.incident.site });
    });
  }

  await step("Avisos de exposición faltante", () => syncExposureDueItems(t.id));
}

export async function seedSafetyTenantB(t: DemoTenant) {
  const actor: SafetyUser = { userId: t.users.admin.userId, role: "tenant_admin", isPlatformSuperuser: false };
  const month = lastMonths(1)[0];
  await step("B: exposición y accidente", async () => {
    await saveExposure({ tenantId: t.id, actor, siteId: t.siteIds["Planta Plottier"], month, own: { hours: 3200, headcountAvg: 18 } });
    await createIncidentWithFinding({
      tenantId: t.id, actor, title: "Resbalón en el sector de envasado", description: "Resbalón sin lesiones en piso mojado.",
      fact: { siteId: t.siteIds["Planta Plottier"], occurredAt: daysAgo(12), classification: "near_miss", inItinere: false, isRoad: false, employerKind: "own", restrictedWork: false, accidentForm: "fall_same_level", materialAgent: "floor_stairs" },
    });
  });
}
