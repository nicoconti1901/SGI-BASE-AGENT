"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, EmptyState, Field, FormError, HintCallout, INPUT_CLASS, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";
import {
  applyRosterAction,
  previewRosterAction,
  type RosterPreviewView,
  type RosterState,
} from "@/app/(tenant)/t/[slug]/master-data/people-actions";
import { MASTER_DATA_ENTITY_LABELS, type MasterDataEntity } from "@/domain/masterdata/types";

const TEMPLATE = [
  "legajo,nombre,dni,sede,sedes_adicionales,puesto,empresa,contratista,ingreso,tareas",
  "1042,Ana Pérez,30111222,Base Neuquén,Obrador 1|Yacimiento 2,Operario,propia,,15/01/2024,Trabajo en altura|Izaje",
  "2001,Luis Gómez,28999111,Obrador 1,,Soldador,contratista,Montajes del Sur SA,2025-03-01,Soldadura",
].join("\n");

const ACTION_LABEL = { create: "Nueva", update: "Actualiza", unchanged: "Sin cambios", blocked: "Bloqueada" } as const;
const ACTION_CHIP = { create: "ok", update: "info", unchanged: "pending", blocked: "danger" } as const;
const ENTITIES: MasterDataEntity[] = ["site", "position", "task"];
const SHOWN = 100;

export function RosterImport({ slug }: { slug: string }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState<RosterState>({});
  const [allowCreate, setAllowCreate] = useState(false);
  const [pending, start] = useTransition();

  const preview = state.preview;
  const missing = preview ? ENTITIES.reduce((n, e) => n + preview.toCreate[e].length, 0) : 0;
  const importable = preview ? preview.counts.create + preview.counts.update : 0;
  const blockedByCatalog = Boolean(preview && (preview.inactiveReferenced.length > 0 || (missing > 0 && !allowCreate)));

  function onFile(file: File | undefined) {
    if (!file) return;
    setAllowCreate(false);
    setFileName(file.name);
    start(async () => {
      const text = await file.text();
      setCsv(text);
      setState(await previewRosterAction(slug, text));
    });
  }

  function confirm() {
    start(async () => setState(await applyRosterAction(slug, csv, allowCreate)));
  }

  if (state.done) {
    const { counts, created, errors } = state.done;
    const createdNames = ENTITIES.filter((e) => created[e].length > 0).map(
      (e) => `${created[e].length} ${MASTER_DATA_ENTITY_LABELS[e]}(s): ${created[e].join(", ")}`,
    );
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="font-semibold text-[var(--color-success)]">
          Importación lista: {counts.create} nueva(s), {counts.update} actualizada(s), {counts.unchanged} sin cambios
          {counts.blocked ? `, ${counts.blocked} bloqueada(s)` : ""}
          {errors ? `, ${errors} línea(s) con error sin importar` : ""}.
        </p>
        {createdNames.length > 0 ? <p className="text-sm text-[var(--color-ink-muted)]">También se crearon: {createdNames.join(" · ")}.</p> : null}
        <div>
          <Link href={`/t/${slug}/master-data/people`} className={buttonClass("primary")}>
            Ver personas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HintCallout>
        Una fila por persona. Columnas: legajo, nombre, sede, puesto (obligatorias) y dni, sedes_adicionales, empresa, contratista,
        ingreso, tareas. Varias sedes o tareas en una celda se separan con «|». Si el legajo ya existe se actualiza; no se duplica.
      </HintCallout>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem] flex-1">
          <Field label="Archivo CSV" hint="Hasta 2 MB. Sirve el CSV de Excel (coma o punto y coma).">
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className={INPUT_CLASS} />
          </Field>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${TEMPLATE}`)}`}
          download="plantilla-nomina.csv"
          className={buttonClass("ghost")}
        >
          Descargar plantilla
        </a>
      </div>

      {pending && !preview ? <p role="status" className="text-sm text-[var(--color-ink-muted)]">Leyendo el archivo…</p> : null}
      {state.error ? <FormError>{state.error}</FormError> : null}

      {preview ? (
        <Preview
          preview={preview}
          fileName={fileName}
          allowCreate={allowCreate}
          setAllowCreate={setAllowCreate}
          missing={missing}
        />
      ) : null}

      {preview ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={confirm} disabled={pending || importable === 0 || blockedByCatalog}>
            {pending ? "Importando…" : `Confirmar e importar ${importable} persona(s)`}
          </Button>
          {importable === 0 ? <span className="text-sm text-[var(--color-ink-muted)]">No hay nada para importar.</span> : null}
          {missing > 0 && !allowCreate ? (
            <span className="text-sm text-[var(--color-ink-muted)]">Confirmá la creación de lo que falta para continuar.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Preview({
  preview,
  fileName,
  allowCreate,
  setAllowCreate,
  missing,
}: {
  preview: RosterPreviewView;
  fileName: string;
  allowCreate: boolean;
  setAllowCreate: (v: boolean) => void;
  missing: number;
}) {
  const changes = preview.items.filter((i) => i.action !== "unchanged");
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-ink-muted)]">Vista previa de {fileName}. Todavía no se guardó nada.</p>
      <StatGrid cols={4} aria-label="Resultado de la vista previa">
        <StatTile label="Nuevas" value={String(preview.counts.create)} />
        <StatTile label="Actualizadas" value={String(preview.counts.update)} />
        <StatTile label="Sin cambios" value={String(preview.counts.unchanged)} />
        <StatTile
          label="Con error o bloqueadas"
          value={String(preview.errors.length + preview.counts.blocked)}
          tone={preview.errors.length + preview.counts.blocked > 0 ? "danger" : "default"}
        />
      </StatGrid>

      {preview.inactiveReferenced.length > 0 ? (
        <FormError>
          El archivo usa sedes, puestos o tareas dados de baja: {preview.inactiveReferenced.join(", ")}. Reactivalos o corregí el archivo.
        </FormError>
      ) : null}

      {missing > 0 ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-warning-line)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm">
          <p className="font-semibold text-[var(--color-warning)]">Se van a crear datos que todavía no existen:</p>
          <ul className="list-disc pl-5">
            {ENTITIES.filter((e) => preview.toCreate[e].length > 0).map((e) => (
              <li key={e}>
                {MASTER_DATA_ENTITY_LABELS[e][0].toUpperCase() + MASTER_DATA_ENTITY_LABELS[e].slice(1)}s: {preview.toCreate[e].join(", ")}
              </li>
            ))}
          </ul>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={allowCreate} onChange={(e) => setAllowCreate(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--color-accent)]" />
            <span>Sí, crear lo que falta al importar. Revisá que no sea un error de tipeo.</span>
          </label>
        </div>
      ) : null}

      {preview.errors.length > 0 ? (
        <section aria-label="Filas con error" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Filas con error (no se importan)</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {preview.errors.slice(0, SHOWN).map((e, i) => (
              <li key={i} className="px-4 py-2">
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">Línea {e.line} · {e.field}</span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
          {preview.errors.length > SHOWN ? <p className="text-xs text-[var(--color-ink-muted)]">Y {preview.errors.length - SHOWN} más.</p> : null}
        </section>
      ) : null}

      {changes.length > 0 ? (
        <section aria-label="Cambios a aplicar" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Qué va a pasar</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {changes.slice(0, SHOWN).map((i) => (
              <li key={i.line} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-[family-name:var(--font-mono)] tabular-nums">{i.code}</span> · {i.name}
                  {i.changes.length ? <span className="text-[var(--color-ink-muted)]"> · cambia {i.changes.join(", ")}</span> : null}
                  {i.reason ? <span className="block text-xs text-[var(--color-danger)]">{i.reason}</span> : null}
                </span>
                <StatusChip status={ACTION_CHIP[i.action]} label={ACTION_LABEL[i.action]} />
              </li>
            ))}
          </ul>
          {changes.length > SHOWN ? <p className="text-xs text-[var(--color-ink-muted)]">Se muestran {SHOWN} de {changes.length}; se aplican todas.</p> : null}
        </section>
      ) : (
        <EmptyState what="El archivo no trae cambios." next="la nómina ya está al día con este CSV." />
      )}
    </div>
  );
}
