"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button, EmptyState, Field, FormError, HintCallout, INPUT_CLASS, StatGrid, StatTile, StatusChip, buttonClass } from "@/components/ui";
import {
  applySupplierImportAction,
  previewSupplierImportAction,
  type SupplierImportPreviewView,
  type SupplierImportState,
} from "@/app/(tenant)/t/[slug]/suppliers/actions";
import { formatCuit } from "@/domain/suppliers/cuit";
import { SUPPLIER_CSV_TEMPLATE } from "@/domain/suppliers/import";
import { SUPPLIER_CRITICALITY_LABELS, SUPPLIER_TYPE_LABELS } from "@/domain/suppliers/types";

const SHOWN = 100;

export function SupplierImport({ slug }: { slug: string }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [state, setState] = useState<SupplierImportState>({});
  const [pending, start] = useTransition();
  const preview = state.preview;

  function onFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    start(async () => {
      const text = await file.text();
      setCsv(text);
      setState(await previewSupplierImportAction(slug, text));
    });
  }

  function confirm() {
    start(async () => setState(await applySupplierImportAction(slug, csv)));
  }

  if (state.done) {
    const { created, existing, errors } = state.done;
    return (
      <div className="flex flex-col gap-4" role="status">
        <p className="font-semibold text-[var(--color-success)]">
          Importación lista: {created} proveedor{created === 1 ? "" : "es"} nuevo{created === 1 ? "" : "s"}, {existing} que ya existía{existing === 1 ? "" : "n"}
          {errors ? `, ${errors} fila(s) con error sin importar` : ""}.
        </p>
        <p className="text-sm text-[var(--color-ink-muted)]">Todos quedaron «sin evaluar». El siguiente paso es evaluar a los críticos.</p>
        <div>
          <Link href={`/t/${slug}/suppliers`} className={buttonClass("primary")}>
            Ver proveedores
          </Link>
        </div>
      </div>
    );
  }

  const importable = preview?.counts.create ?? 0;
  return (
    <div className="flex flex-col gap-5">
      <HintCallout>
        Una fila por proveedor. Columnas obligatorias: razon_social y tipo (producto, servicio o contratista). Opcionales: cuit, rubro, criticidad
        (crítico, estándar o bajo impacto), motivo_criticidad, responsable (email de un usuario), contacto, email, telefono y notas. Para
        proveedores críticos y de bajo impacto el motivo es obligatorio. Se reconoce a cada uno por su CUIT: no se duplica.
      </HintCallout>

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[16rem] flex-1">
          <Field label="Archivo CSV" hint="Hasta 2 MB. Sirve el CSV de Excel (coma o punto y coma).">
            <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} className={INPUT_CLASS} />
          </Field>
        </div>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(`﻿${SUPPLIER_CSV_TEMPLATE}`)}`}
          download="plantilla-proveedores.csv"
          className={buttonClass("ghost")}
        >
          Descargar plantilla
        </a>
      </div>

      {pending && !preview ? <p role="status" className="text-sm text-[var(--color-ink-muted)]">Leyendo el archivo…</p> : null}
      {state.error ? <FormError>{state.error}</FormError> : null}
      {preview ? <Preview preview={preview} fileName={fileName} /> : null}

      {preview ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={confirm} disabled={pending || importable === 0}>
            {pending ? "Importando…" : `Confirmar e importar ${importable} proveedor${importable === 1 ? "" : "es"}`}
          </Button>
          {importable === 0 ? <span className="text-sm text-[var(--color-ink-muted)]">No hay nada para importar.</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function Preview({ preview, fileName }: { preview: SupplierImportPreviewView; fileName: string }) {
  const news = preview.items.filter((i) => i.action === "create");
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-[var(--color-ink-muted)]">Vista previa de {fileName}. Todavía no se guardó nada.</p>
      <StatGrid cols={3} aria-label="Resultado de la vista previa">
        <StatTile label="Nuevos" value={String(preview.counts.create)} />
        <StatTile label="Ya existentes" value={String(preview.counts.exists)} />
        <StatTile label="Con error" value={String(preview.errors.length)} tone={preview.errors.length > 0 ? "danger" : "default"} />
      </StatGrid>

      {preview.errors.length > 0 ? (
        <section aria-label="Filas con error" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Filas con error (no se importan)</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {preview.errors.slice(0, SHOWN).map((e, i) => (
              <li key={i} className="px-4 py-2">
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-ink-muted)]">Fila {e.line} · {e.field}</span> {e.message}
              </li>
            ))}
          </ul>
          {preview.errors.length > SHOWN ? <p className="text-xs text-[var(--color-ink-muted)]">Y {preview.errors.length - SHOWN} más.</p> : null}
        </section>
      ) : null}

      {news.length > 0 ? (
        <section aria-label="Proveedores nuevos" className="flex flex-col gap-2">
          <h3 className="font-[family-name:var(--font-display)] text-base font-semibold">Qué va a pasar</h3>
          <ul className="divide-y divide-[var(--color-line)] rounded-[var(--radius-md)] border border-[var(--color-line)] text-sm">
            {news.slice(0, SHOWN).map((i) => (
              <li key={i.line} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {i.name}
                  <span className="ml-2 text-[var(--color-ink-muted)]">
                    {i.taxId ? formatCuit(i.taxId) : "Sin CUIT"} · {SUPPLIER_TYPE_LABELS[i.type]} · {SUPPLIER_CRITICALITY_LABELS[i.criticality]}
                  </span>
                </span>
                <StatusChip status="pending" label="Entra sin evaluar" />
              </li>
            ))}
          </ul>
          {news.length > SHOWN ? <p className="text-xs text-[var(--color-ink-muted)]">Se muestran {SHOWN} de {news.length}; se importan todos.</p> : null}
        </section>
      ) : (
        <EmptyState what="El archivo no trae proveedores nuevos." next="los que figuran ya están cargados o tienen errores." />
      )}
    </div>
  );
}
