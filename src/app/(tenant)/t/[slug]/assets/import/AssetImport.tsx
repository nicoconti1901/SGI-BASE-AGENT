"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, EmptyState, Field, FormError, HintCallout, INPUT_CLASS, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";
import {
  applyAssetImportAction,
  previewAssetImportAction,
  type AssetImportPreviewView,
  type AssetImportState,
} from "@/app/(tenant)/t/[slug]/assets/actions";

const ACTION_LABEL = { create: "Nuevo", update: "Actualiza", unchanged: "Sin cambios", error: "Con error" } as const;
const ACTION_CHIP = { create: "ok", update: "info", unchanged: "pending", error: "danger" } as const;
const SHOWN = 100;

export function AssetImport({ slug, typeKey, typeLabel, columns, template }: { slug: string; typeKey: string; typeLabel: string; columns: string; template: string }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState<AssetImportState>({});
  const [pending, start] = useTransition();

  const preview = state.preview;
  const importable = preview ? preview.counts.create + preview.counts.update : 0;

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    start(async () => {
      const text = await file.text();
      setCsv(text);
      setState(await previewAssetImportAction(slug, typeKey, text));
    });
  }

  function confirm() {
    start(async () => setState(await applyAssetImportAction(slug, typeKey, csv)));
  }

  if (state.done) {
    const { counts, errors } = state.done;
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="font-semibold text-[var(--color-success)]">
          Importación lista: {counts.create} nuevo(s), {counts.update} actualizado(s), {counts.unchanged} sin cambios
          {counts.error + errors ? `, ${counts.error + errors} fila(s) con error sin importar` : ""}.
        </p>
        <div>
          <Link href={`/t/${slug}/assets`} className={buttonClass("primary")}>
            Ver activos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HintCallout>
        Una fila por {typeLabel.toLowerCase()}. Columnas: {columns}. La sede tiene que existir en Datos maestros (el CSV no crea sedes). Si el código ya existe se
        actualiza; no se duplica. Hasta 1.000 filas.
      </HintCallout>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem] flex-1">
          <Field label="Archivo CSV" hint="Hasta 2 MB. Sirve el CSV de Excel (coma o punto y coma).">
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className={INPUT_CLASS} />
          </Field>
        </div>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${template}`)}`} download={`plantilla-${typeKey}.csv`} className={buttonClass("ghost")}>
          Descargar plantilla
        </a>
      </div>

      {pending && !preview ? (
        <p role="status" className="text-sm text-[var(--color-ink-muted)]">
          Leyendo el archivo…
        </p>
      ) : null}
      {state.error ? <FormError>{state.error}</FormError> : null}

      {preview ? <Preview preview={preview} fileName={fileName} /> : null}

      {preview ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={confirm} disabled={pending || importable === 0}>
            {pending ? "Importando…" : `Confirmar e importar ${importable} activo(s)`}
          </Button>
          {importable === 0 ? <span className="text-sm text-[var(--color-ink-muted)]">No hay nada para importar.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Preview({ preview, fileName }: { preview: AssetImportPreviewView; fileName: string }) {
  const changes = preview.items.filter((i) => i.action !== "unchanged");
  const errorCount = preview.errors.length + preview.counts.error;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-ink-muted)]">Vista previa de {fileName}. Todavía no se guardó nada.</p>
      <StatGrid cols={4} aria-label="Resultado de la vista previa">
        <StatTile label="Nuevos" value={String(preview.counts.create)} />
        <StatTile label="Actualizados" value={String(preview.counts.update)} />
        <StatTile label="Sin cambios" value={String(preview.counts.unchanged)} />
        <StatTile label="Con error" value={String(errorCount)} tone={errorCount > 0 ? "danger" : "default"} />
      </StatGrid>

      {preview.errors.length > 0 ? (
        <section aria-label="Filas con error de formato" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Filas con error (no se importan)</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {preview.errors.slice(0, SHOWN).map((e, i) => (
              <li key={i} className="px-4 py-2">
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                  Línea {e.line} · {e.field}
                </span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
          {preview.errors.length > SHOWN ? <p className="text-xs text-[var(--color-ink-muted)]">Y {preview.errors.length - SHOWN} más.</p> : null}
        </section>
      ) : null}

      {changes.length > 0 ? (
        <section aria-label="Qué va a pasar" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Qué va a pasar</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {changes.slice(0, SHOWN).map((i) => (
              <li key={i.line} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  <span className="font-[family-name:var(--font-mono)] tabular-nums">{i.code}</span> · {i.description}
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
        <EmptyState what="El archivo no trae cambios." next="los activos ya están al día con este CSV." />
      )}
    </div>
  );
}
