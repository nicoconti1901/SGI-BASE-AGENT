"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, EmptyState, Field, FormError, HintCallout, INPUT_CLASS, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";
import {
  applyExposureImportAction,
  previewExposureImportAction,
  type ExposureImportPreviewView,
  type ExposureImportState,
} from "@/app/(tenant)/t/[slug]/safety/exposure-actions";

const ACTION_LABEL = { create: "Nuevo", update: "Corrige", unchanged: "Sin cambios", error: "Con error" } as const;
const ACTION_CHIP = { create: "ok", update: "info", unchanged: "pending", error: "danger" } as const;
const SHOWN = 100;
const TEMPLATE = "sede;mes;empresa;horas;dotacion\r\nPlanta Norte;2026-03;propio;20000;110\r\nPlanta Norte;2026-03;contratista;5000;28\r\n";

export function ExposureImport({ slug }: { slug: string }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<ExposureImportState>({});
  const [pending, start] = useTransition();

  const preview = state.preview;
  const importable = preview ? preview.counts.create + preview.counts.update : 0;

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    start(async () => {
      const text = await file.text();
      setCsv(text);
      setState(await previewExposureImportAction(slug, text));
    });
  }

  function confirm() {
    start(async () => setState(await applyExposureImportAction(slug, csv, reason)));
  }

  if (state.done) {
    const { counts, errors } = state.done;
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="font-semibold text-[var(--color-success)]">
          Importación lista: {counts.create} nueva(s), {counts.update} corregida(s), {counts.unchanged} sin cambios
          {counts.error + errors ? `, ${counts.error + errors} fila(s) con error sin importar` : ""}.
        </p>
        <div>
          <Link href={`/t/${slug}/safety/exposure`} className={buttonClass("primary")}>
            Ver las horas cargadas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <HintCallout>
        Una fila por sede, mes y grupo. Columnas: sede, mes (AAAA-MM), empresa (propio o contratista), horas y dotacion. Las sedes se buscan por nombre y no se crean solas. Si la fila ya está
        cargada con otros valores se corrige (y hay que dar el motivo); si es igual, no pasa nada. Hasta 2.000 filas.
      </HintCallout>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem] flex-1">
          <Field label="Archivo CSV" hint="Hasta 2 MB. Sirve el CSV de Excel (coma o punto y coma).">
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className={INPUT_CLASS} />
          </Field>
        </div>
        <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${TEMPLATE}`)}`} download="plantilla-horas-trabajadas.csv" className={buttonClass("ghost")}>
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

      {preview?.needsReason ? (
        <Field label="Motivo de las correcciones" required hint="El archivo cambia valores ya cargados. Queda registrado con tu nombre.">
          <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} className={INPUT_CLASS} />
        </Field>
      ) : null}

      {preview ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={confirm} disabled={pending || importable === 0}>
            {pending ? "Importando…" : `Confirmar e importar ${importable} fila(s)`}
          </Button>
          {importable === 0 ? <span className="text-sm text-[var(--color-ink-muted)]">No hay nada para importar.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Preview({ preview, fileName }: { preview: ExposureImportPreviewView; fileName: string }) {
  const errorCount = preview.parseErrors.length + preview.counts.error;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-ink-muted)]">Vista previa de {fileName}. Todavía no se guardó nada.</p>
      <StatGrid cols={4} aria-label="Resultado de la vista previa">
        <StatTile label="Nuevas" value={String(preview.counts.create)} />
        <StatTile label="Correcciones" value={String(preview.counts.update)} />
        <StatTile label="Sin cambios" value={String(preview.counts.unchanged)} />
        <StatTile label="Con error" value={String(errorCount)} tone={errorCount > 0 ? "danger" : "default"} />
      </StatGrid>

      {preview.parseErrors.length > 0 ? (
        <section aria-label="Filas con error de formato" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Filas con error de formato (no se importan)</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {preview.parseErrors.slice(0, SHOWN).map((e, i) => (
              <li key={i} className="px-4 py-2">
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">
                  Línea {e.line} · {e.field}
                </span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {preview.items.length > 0 ? (
        <section aria-label="Qué va a pasar" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Qué va a pasar</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {preview.items.slice(0, SHOWN).map((i) => (
              <li key={i.line} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {i.siteRef} · {i.month} · {i.employerKind === "own" ? "propio" : "contratista"} · {i.hours.toLocaleString("es-AR")} h / {i.headcountAvg}
                  {i.message ? <span className="block text-xs text-[var(--color-danger)]">Línea {i.line}: {i.message}</span> : null}
                </span>
                <StatusChip status={ACTION_CHIP[i.action]} label={ACTION_LABEL[i.action]} />
              </li>
            ))}
          </ul>
        </section>
      ) : preview.counts.unchanged > 0 ? (
        <EmptyState what="El archivo no trae cambios." next="las horas ya están al día con este CSV." />
      ) : null}
    </div>
  );
}
