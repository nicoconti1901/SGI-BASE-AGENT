import { createAsset } from "../../src/lib/assets";
import { addInspectionPhoto, closeInspection, getInspectionView, saveAnswer, saveInspectionMeta, startInspection } from "../../src/lib/inspections";
import { scheduleSiteInspection, startSiteInspection } from "../../src/lib/inspection-sites";
import { setMonthlyTarget, startFieldAudit } from "../../src/lib/inspection-field-audit";
import { completeAction } from "../../src/lib/actions";
import { uploadActionAttachment } from "../../src/lib/action-attachments";
import { ACTION_ENTITY_TYPE } from "../../src/domain/actions/types";
import { addDays, todayIso } from "../../src/domain/inspections/dates";
import { DEMO_PNG, db, demoPdf, pick, step, type DemoTenant } from "./kit";

const TODAY = todayIso();
const ago = (days: number) => addDays(TODAY, -days);
const ahead = (days: number) => addDays(TODAY, days);

type NcPlan = { criticality: "critical" | "major" | "minor"; count: number };
type FillOptions = {
  nc?: NcPlan[];
  /** Foto opcional en el primer ítem conforme: prueba la galería sin que sea una no conformidad. */
  extraPhoto?: boolean;
  reading?: number;
  comment?: string;
};

/** Responde una inspección abierta: todo conforme, salvo las no conformidades pedidas (con comentario y foto). */
async function fill(t: DemoTenant, inspectionId: string, actorUserId: string, canEditOthers: boolean, options: FillOptions = {}) {
  const view = (await getInspectionView(t.id, inspectionId))!;
  const left = new Map((options.nc ?? []).map((p) => [p.criticality, p.count]));
  let photoDone = false;
  for (const row of view.items) {
    if (row.answer.autoDerived) continue;
    const { item } = row;
    const base = { tenantId: t.id, actorUserId, canEditOthers, inspectionId, itemId: item.id };
    if (item.kind === "check") {
      const remaining = left.get(item.criticality as NcPlan["criticality"]) ?? 0;
      if (remaining > 0) {
        left.set(item.criticality as NcPlan["criticality"], remaining - 1);
        await saveAnswer({ ...base, patch: { value: "nonconform", comment: options.comment ?? "Se observó el desvío; queda registrado para su corrección." } });
        if (item.photoOnNc) {
          await addInspectionPhoto({ ...base, fileName: `desvio-${item.code}.png`, contentType: "image/png", body: DEMO_PNG });
        }
      } else {
        await saveAnswer({ ...base, patch: { value: "conform" } });
        if (options.extraPhoto && !photoDone) {
          photoDone = true;
          await addInspectionPhoto({ ...base, fileName: `estado-${item.code}.png`, contentType: "image/png", body: DEMO_PNG });
        }
      }
    } else if (item.kind === "number") {
      const min = item.minValue === null ? null : Number(item.minValue);
      const max = item.maxValue === null ? null : Number(item.maxValue);
      const value = min !== null && max !== null ? (min + max) / 2 : (min ?? max ?? 1);
      await saveAnswer({ ...base, patch: { numberValue: value } });
    } else if (item.kind === "reading") {
      await saveAnswer({ ...base, patch: { numberValue: options.reading ?? 1000 } });
    } else if (item.kind === "text") {
      await saveAnswer({ ...base, patch: { textValue: "Sin novedades en la recorrida." } });
    }
  }
}

async function runInspection(
  t: DemoTenant,
  who: "admin" | "hse" | "inspector" | "operaciones" | "colaborador",
  open: () => Promise<{ id: string }>,
  options: FillOptions & { performedBy?: string; notes?: string } = {},
) {
  const user = t.users[who];
  const canEditOthers = who === "admin" || who === "hse";
  const { id } = await open();
  await fill(t, id, user.userId, canEditOthers, options);
  if (options.performedBy || options.notes) {
    await saveInspectionMeta({ tenantId: t.id, actorUserId: user.userId, canEditOthers, inspectionId: id, performedByPersonId: options.performedBy ?? null, notes: options.notes ?? null });
  }
  const outcome = await closeInspection({ tenantId: t.id, actorUserId: user.userId, canEditOthers, inspectionId: id, confirmLowerReadings: true });
  return { id, outcome };
}

const EXTINGUISHERS = [
  { code: "EXT-001", agent: "abc", kg: 5, site: "Base Añelo", mfg: "2022-05-10", last: 90, where: "Taller mecánico" },
  { code: "EXT-002", agent: "abc", kg: 10, site: "Base Añelo", mfg: "2021-03-02", last: 150, where: "Depósito de repuestos" },
  { code: "EXT-003", agent: "co2", kg: 5, site: "Oficina Neuquén", mfg: "2023-08-21", last: 335, where: "Sala de servidores" },
  { code: "EXT-004", agent: "abc", kg: 5, site: "Oficina Neuquén", mfg: "2020-11-30", last: 400, where: "Recepción" },
  { code: "EXT-005", agent: "foam_afff", kg: 9, site: "Obra Loma Campana", mfg: "2022-01-15", last: 60, where: "Obrador principal" },
  { code: "EXT-006", agent: "abc", kg: 10, site: "Obra Loma Campana", mfg: "2019-07-07", last: 365, where: "Playón de maquinaria" },
  { code: "EXT-007", agent: "water", kg: 10, site: "Planta Centenario", mfg: "2021-09-12", last: 200, where: "Sector pintura" },
  { code: "EXT-008", agent: "bc", kg: 5, site: "Planta Centenario", mfg: "2024-02-19", last: 20, where: "Tablero eléctrico" },
  { code: "EXT-009", agent: "class_k", kg: 6, site: "Campamento Sauzal", mfg: "2023-04-03", last: 380, where: "Cocina del campamento" },
  { code: "EXT-010", agent: "abc", kg: 5, site: "Campamento Sauzal", mfg: "2022-10-26", last: 100, where: "Comedor" },
  { code: "EXT-011", agent: "hcfc", kg: 2, site: "Base Añelo", mfg: "2024-06-11", last: 330, where: "Sala de control" },
  { code: "EXT-012", agent: "abc", kg: 50, site: "Planta Centenario", mfg: "2018-12-05", last: 45, where: "Playa de carga", onWheels: true },
  { code: "EXT-013", agent: "abc", kg: 5, site: "Obra Loma Campana", mfg: "2020-05-18", last: 500, where: "Camioneta de supervisión", installedIn: "vehicle" },
  { code: "EXT-014", agent: "abc", kg: 5, site: "Base Añelo", mfg: "2023-12-01", last: 10, where: "Camión cisterna", installedIn: "vehicle" },
] as const;

const HARNESSES = [
  { code: "ARN-001", kind: "harness", serial: "SN-884201", brand: "3M DBI-Sala", mfg: "2023-03-15", years: 10, site: "Obra Loma Campana", person: "L-007" },
  { code: "ARN-002", kind: "harness", serial: "SN-884202", brand: "3M DBI-Sala", mfg: "2023-03-15", years: 10, site: "Obra Loma Campana", person: "L-015" },
  { code: "ARN-003", kind: "lanyard_double", serial: "CV-55120", brand: "Miller", mfg: "2022-08-01", years: 5, site: "Obra Loma Campana", person: "L-008" },
  { code: "ARN-004", kind: "retractable", serial: "RT-90331", brand: "Capital Safety", mfg: "2021-05-20", years: 10, site: "Planta Centenario", person: "L-014" },
  { code: "ARN-005", kind: "lanyard_single", serial: "CV-55121", brand: "Miller", mfg: "2018-01-10", years: 5, site: "Base Añelo", person: "L-004" },
  { code: "ARN-006", kind: "positioning_lanyard", serial: "PL-20441", brand: "Petzl", mfg: "2024-01-09", years: 10, site: "Obra Loma Campana", person: "L-019" },
  { code: "ARN-007", kind: "harness", serial: "SN-884310", brand: "MSA", mfg: "2020-09-02", years: 10, site: "Planta Centenario", person: null },
  { code: "ARN-008", kind: "carabiner", serial: "CA-77120", brand: "Petzl", mfg: "2023-11-20", years: 10, site: "Obra Loma Campana", person: null },
] as const;

const VEHICLES = [
  { code: "VL-01", plate: "AF412KD", brand: "Toyota", model: "Hilux 4x4", year: 2022, km: 48200, rollbar: true, sat: true, site: "Base Añelo", driver: "L-011", insurance: 120, rto: 200, service: 40 },
  { code: "VL-02", plate: "AE930TM", brand: "Ford", model: "Ranger", year: 2021, km: 91450, rollbar: true, sat: true, site: "Base Añelo", driver: "L-012", insurance: 12, rto: -5, service: -20 },
  { code: "VL-03", plate: "AG118PX", brand: "Volkswagen", model: "Amarok", year: 2023, km: 22100, rollbar: false, sat: false, site: "Obra Loma Campana", driver: "L-004", insurance: 300, rto: 340, service: 90 },
  { code: "VL-04", plate: "AD655RC", brand: "Renault", model: "Kangoo", year: 2019, km: 134800, rollbar: false, sat: false, site: "Oficina Neuquén", driver: null, insurance: -10, rto: 25, service: 10 },
  { code: "VL-05", plate: "AH207ZB", brand: "Toyota", model: "Hilux 4x4", year: 2024, km: 9800, rollbar: true, sat: true, site: "Planta Centenario", driver: "L-014", insurance: 200, rto: 250, service: 150, contractor: "Transportes Cuyo SA" },
] as const;

const HEAVY = [
  { code: "EQ-01", kind: "crane", brand: "Liebherr", model: "LTM 1050", year: 2018, road: true, lifting: true, reading: 6420, site: "Obra Loma Campana", insurance: 180, service: 25, rto: 60, cert: 200, review: 14, operator: "L-013" },
  { code: "EQ-02", kind: "forklift", brand: "Hyster", model: "H3.0FT", year: 2020, road: false, lifting: false, reading: 3120, site: "Planta Centenario", insurance: 90, service: -8, rto: 0, cert: 0, review: 0, operator: "L-010" },
  { code: "EQ-03", kind: "backhoe", brand: "Caterpillar", model: "416F2", year: 2019, road: true, lifting: false, reading: 8800, site: "Obra Loma Campana", insurance: 40, service: 70, rto: -15, cert: 0, review: 0, operator: null },
  { code: "EQ-04", kind: "hydro_crane", brand: "Palfinger", model: "PK 18500", year: 2022, road: true, lifting: true, reading: 2100, site: "Base Añelo", insurance: 250, service: 100, rto: 300, cert: 90, review: -3, operator: "C-103", contractor: "Izajes Patagonia SA" },
] as const;

/** Activos de los cuatro tipos con vencimientos en todos los estados (vigente, por vencer, vencido). */
async function seedAssets(t: DemoTenant) {
  const actorUserId = t.users.hse.userId;
  const personId = (code: string | null | undefined) => (code ? t.people.find((p) => p.code === code)?.id : undefined);
  const ids: Record<string, string> = {};

  for (const [i, e] of EXTINGUISHERS.entries()) {
    const asset = await step(`Activo ${e.code}`, () =>
      createAsset({
        tenantId: t.id,
        actorUserId,
        typeKey: "extinguisher",
        code: e.code,
        description: `Extintor ${e.agent.toUpperCase()} ${e.kg} kg`,
        siteId: t.siteIds[e.site],
        sector: e.where,
        attributes: {
          agent: e.agent,
          capacityKg: e.kg,
          manufacturedAt: e.mfg,
          cylinderNumber: `CIL-${3000 + i}`,
          rechargeCompany: pick(["Matafuegos Neuquén SRL", "Extinguir SA", "Fuego Cero"], i),
          installedIn: "installedIn" in e ? e.installedIn : "fixed",
          ...("onWheels" in e ? { onWheels: true } : {}),
        },
        dueDates: [
          { kind: "maintenance", lastDoneAt: ago(e.last) },
          ...(i % 4 === 0 ? [{ kind: "hydrostatic_test", lastDoneAt: ago(1500 + i * 20) }] : []),
        ],
      }),
    );
    if (asset) ids[e.code] = asset.id;
  }

  for (const h of HARNESSES) {
    const asset = await step(`Activo ${h.code}`, () =>
      createAsset({
        tenantId: t.id,
        actorUserId,
        typeKey: "fall_protection",
        code: h.code,
        description: `${h.brand} · ${h.kind.replace("_", " ")}`,
        siteId: t.siteIds[h.site],
        assignedPersonId: personId(h.person) ?? null,
        attributes: { kind: h.kind, brand: h.brand, serialNumber: h.serial, certificationStandard: "IRAM 3622-1", manufacturedAt: h.mfg, serviceLifeYears: h.years },
        dueDates: [],
      }),
    );
    if (asset) ids[h.code] = asset.id;
  }

  for (const v of VEHICLES) {
    const asset = await step(`Activo ${v.code}`, () =>
      createAsset({
        tenantId: t.id,
        actorUserId,
        typeKey: "light_vehicle",
        code: v.code,
        description: `${v.brand} ${v.model} ${v.plate}`,
        siteId: t.siteIds[v.site],
        assignedPersonId: personId(v.driver) ?? null,
        ownership: "contractor" in v ? "contractor" : "own",
        contractorName: "contractor" in v ? v.contractor : null,
        attributes: { plate: v.plate, brand: v.brand, model: v.model, year: v.year, initialOdometerKm: v.km, hasRollbar: v.rollbar, hasSatelliteMonitoring: v.sat },
        dueDates: [
          { kind: "insurance", dueAt: ahead(v.insurance) },
          { kind: "rto", dueAt: ahead(v.rto) },
          { kind: "service", dueAt: ahead(v.service) },
          ...(v.sat ? [{ kind: "satellite_monitoring", dueAt: ahead(180) }] : []),
        ],
      }),
    );
    if (asset) ids[v.code] = asset.id;
  }

  for (const h of HEAVY) {
    const asset = await step(`Activo ${h.code}`, () =>
      createAsset({
        tenantId: t.id,
        actorUserId,
        typeKey: "heavy_equipment",
        code: h.code,
        description: `${h.brand} ${h.model}`,
        siteId: t.siteIds[h.site],
        assignedPersonId: personId(h.operator) ?? null,
        ownership: "contractor" in h ? "contractor" : "own",
        contractorName: "contractor" in h ? h.contractor : null,
        attributes: { equipmentKind: h.kind, brand: h.brand, model: h.model, year: h.year, circulatesOnPublicRoad: h.road, hasLiftingGear: h.lifting, initialReading: h.reading },
        dueDates: [
          { kind: "insurance", dueAt: ahead(h.insurance) },
          { kind: "service", dueAt: ahead(h.service) },
          ...(h.road ? [{ kind: "rto", dueAt: ahead(h.rto) }] : []),
          ...(h.lifting ? [{ kind: "lifting_certification", dueAt: ahead(h.cert) }, { kind: "lifting_review", dueAt: ahead(h.review) }] : []),
        ],
      }),
    );
    if (asset) ids[h.code] = asset.id;
  }
  return ids;
}

/** Inspecciones cerradas con distintos resultados, borradores abiertos y el circuito completo de una no conformidad. */
async function seedInspections(t: DemoTenant, assets: Record<string, string>) {
  const start = (who: "inspector" | "operaciones" | "colaborador" | "hse" | "admin", code: string, templateKey?: string) => () =>
    startInspection({ tenantId: t.id, actorUserId: t.users[who].userId, assetId: assets[code], templateKey });

  // Extintores: conforme con foto, no conformidad menor, mayor y crítica (esta última con hallazgo en borrador).
  await step("Inspección EXT-001 conforme con foto", () => runInspection(t, "inspector", start("inspector", "EXT-001"), { extraPhoto: true, performedBy: t.users.inspector.personId }));
  await step("Inspección EXT-002 con NC menor", () => runInspection(t, "inspector", start("inspector", "EXT-002"), { nc: [{ criticality: "minor", count: 1 }], comment: "Precinto de seguridad suelto." }));
  await step("Inspección EXT-005 con NC mayor", () => runInspection(t, "colaborador", start("colaborador", "EXT-005"), { nc: [{ criticality: "major", count: 1 }], comment: "Manómetro fuera de la zona verde." }));
  const critical = await step("Inspección EXT-003 con NC crítica", () => runInspection(t, "operaciones", start("operaciones", "EXT-003"), { nc: [{ criticality: "critical", count: 1 }], comment: "Cilindro con corrosión visible en la base." }));
  await step("Inspección EXT-008 conforme", () => runInspection(t, "inspector", start("inspector", "EXT-008"), { extraPhoto: true }));
  await step("Inspección EXT-012 conforme", () => runInspection(t, "inspector", start("inspector", "EXT-012")));

  // Arneses: uno conforme y uno no apto.
  await step("Inspección ARN-001 conforme", () => runInspection(t, "inspector", start("inspector", "ARN-001"), { extraPhoto: true }));
  await step("Inspección ARN-003 con NC crítica", () => runInspection(t, "inspector", start("inspector", "ARN-003"), { nc: [{ criticality: "critical", count: 1 }], comment: "Costura deshilachada en el cabo." }));
  await step("Inspección ARN-004 conforme", () => runInspection(t, "colaborador", start("colaborador", "ARN-004")));

  // Vehículos: control previo al uso y periódica.
  await step("Control previo VL-01 conforme", () => runInspection(t, "operaciones", start("operaciones", "VL-01", "light_pre_use"), { reading: 48300 }));
  await step("Control previo VL-02 con NC crítica", () => runInspection(t, "operaciones", start("operaciones", "VL-02", "light_pre_use"), { nc: [{ criticality: "critical", count: 1 }], reading: 91500, comment: "Pérdida de líquido de frenos." }));
  await step("Periódica VL-03 conforme", () => runInspection(t, "inspector", start("inspector", "VL-03"), { extraPhoto: true, reading: 22300 }));
  await step("Periódica VL-05 con NC mayor", () => runInspection(t, "hse", start("hse", "VL-05"), { nc: [{ criticality: "major", count: 2 }], reading: 9900, comment: "Luces traseras sin funcionar." }));

  // Equipos pesados.
  await step("Control previo EQ-01 conforme", () => runInspection(t, "operaciones", start("operaciones", "EQ-01", "heavy_pre_use"), { reading: 6450 }));
  await step("Periódica EQ-02 conforme", () => runInspection(t, "inspector", start("inspector", "EQ-02"), { reading: 3150 }));
  await step("Periódica EQ-03 con NC crítica", () => runInspection(t, "hse", start("hse", "EQ-03"), { nc: [{ criticality: "critical", count: 1 }], reading: 8850, comment: "Pérdida hidráulica en el brazo." }));

  // Inspecciones de área (obradores) y auditoría de campo.
  await step("Obrador Loma Campana con NC", () =>
    runInspection(t, "inspector", () => startSiteInspection({ tenantId: t.id, actorUserId: t.users.inspector.userId, siteId: t.siteIds["Obra Loma Campana"] }), { nc: [{ criticality: "major", count: 2 }, { criticality: "minor", count: 1 }], comment: "Orden y limpieza deficientes en el sector de residuos." }),
  );
  await step("Obrador Planta Centenario conforme", () =>
    runInspection(t, "colaborador", () => startSiteInspection({ tenantId: t.id, actorUserId: t.users.colaborador.userId, siteId: t.siteIds["Planta Centenario"] }), { extraPhoto: true }),
  );
  await step("Programar obrador en Base Añelo y Campamento Sauzal", async () => {
    for (const site of ["Base Añelo", "Campamento Sauzal"]) {
      await scheduleSiteInspection({ tenantId: t.id, actorUserId: t.users.hse.userId, siteId: t.siteIds[site] });
    }
  });
  await step("Auditoría de campo en altura e izaje", () =>
    runInspection(
      t,
      "hse",
      () =>
        startFieldAudit({
          tenantId: t.id,
          actorUserId: t.users.hse.userId,
          siteId: t.siteIds["Obra Loma Campana"],
          jobTaskId: t.taskIds["Trabajo en altura"],
          contractorName: "Montajes Industriales del Comahue SRL",
          supervisorPersonId: t.people.find((p) => p.code === "L-008")?.id ?? null,
          specialTasks: ["height", "lifting"],
        }),
      { nc: [{ criticality: "major", count: 1 }], comment: "Línea de vida sin certificación a la vista." },
    ),
  );
  await step("Metas mensuales de auditorías de campo", async () => {
    await setMonthlyTarget({ tenantId: t.id, actorUserId: t.users.hse.userId, siteId: t.siteIds["Obra Loma Campana"], target: 4 });
    await setMonthlyTarget({ tenantId: t.id, actorUserId: t.users.hse.userId, siteId: t.siteIds["Planta Centenario"], target: 2 });
  });

  // Reinspección que devuelve a servicio el extintor con la no conformidad crítica (la hace una persona que libera activos).
  if (critical) {
    await step("Reinspección EXT-003 conforme (vuelve a servicio)", () => runInspection(t, "hse", start("hse", "EXT-003"), { comment: "Cilindro reemplazado." }));
  }

  // Borradores que quedan abiertos para probar «retomar».
  await step("Borrador abierto en EXT-006", () => start("inspector", "EXT-006")());
  await step("Borrador a medias en VL-04", async () => {
    const { id } = await start("operaciones", "VL-04", "light_pre_use")();
    const view = (await getInspectionView(t.id, id))!;
    const first = view.items.find((r) => r.item.kind === "check" && !r.answer.autoDerived);
    if (first) await saveAnswer({ tenantId: t.id, actorUserId: t.users.operaciones.userId, canEditOthers: false, inspectionId: id, itemId: first.item.id, patch: { value: "conform" } });
  });

  // Cierre del circuito con una acción: una completa con evidencia, otra vencida y las demás abiertas.
  await step("Acciones de inspección: completar una y vencer otra", async () => {
    const actions = await db.action.findMany({ where: { tenantId: t.id, inspection: { isNot: null } }, orderBy: { createdAt: "asc" }, select: { id: true, ownerUserId: true } });
    if (actions[0]) {
      await uploadActionAttachment({ tenantId: t.id, actionId: actions[0].id, fileName: "evidencia-correccion.pdf", contentType: "application/pdf", body: demoPdf("Evidencia de correccion"), uploadedById: actions[0].ownerUserId });
      await completeAction({ tenantId: t.id, actionId: actions[0].id });
    }
    if (actions[1]) {
      const overdue = new Date(`${ago(6)}T12:00:00.000Z`);
      await db.action.update({ where: { id: actions[1].id }, data: { dueAt: overdue } });
      await db.dueItem.updateMany({ where: { tenantId: t.id, entityType: ACTION_ENTITY_TYPE, entityId: actions[1].id, status: "open" }, data: { dueAt: overdue } });
    }
  });
}

export async function seedInspectionsModule(t: DemoTenant) {
  const assets = await step("Activos (extintores, arneses, vehículos, equipos pesados)", () => seedAssets(t));
  if (!assets) return {};
  await seedInspections(t, assets);
  return assets;
}

/** Empresa B: pocos activos, con códigos que se repiten en A para probar el aislamiento. */
export async function seedInspectionsTenantB(t: DemoTenant) {
  const actorUserId = t.users.admin.userId;
  const assets: Record<string, string> = {};
  for (const [code, agent, last] of [["EXT-001", "abc", 100], ["EXT-002", "co2", 380]] as const) {
    const a = await step(`B: activo ${code}`, () =>
      createAsset({
        tenantId: t.id, actorUserId, typeKey: "extinguisher", code, description: `Extintor ${agent.toUpperCase()} 5 kg`, siteId: t.siteIds["Planta Plottier"],
        attributes: { agent, capacityKg: 5, manufacturedAt: "2022-03-03", installedIn: "fixed" }, dueDates: [{ kind: "maintenance", lastDoneAt: ago(last) }],
      }),
    );
    if (a) assets[code] = a.id;
  }
  if (assets["EXT-001"]) {
    await step("B: inspección EXT-001", () => runInspection(t, "colaborador", () => startInspection({ tenantId: t.id, actorUserId: t.users.colaborador.userId, assetId: assets["EXT-001"] }), { extraPhoto: true }));
  }
  return assets;
}
