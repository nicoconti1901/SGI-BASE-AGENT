/**
 * Carpetas del módulo Documentos (ISO 9001 §7.5). Cada documento pertenece a una
 * sola carpeta hoja según su `Document.kind`; «Registros» agrupa dos subcarpetas.
 */

export const DOCUMENT_KINDS = [
  "manual",
  "policy",
  "record_blank",
  "record_managed",
  "procedure",
] as const;

export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Nombre de la carpeta hoja de cada tipo (lo que ve el usuario al elegir dónde va). */
export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  manual: "Manual",
  policy: "Políticas",
  record_blank: "Registros en blanco",
  record_managed: "Registros en gestión",
  procedure: "Procedimientos",
};

export type DocumentFolderKey =
  | "manual"
  | "politicas"
  | "registros"
  | "registros-en-blanco"
  | "registros-en-gestion"
  | "procedimientos";

export type DocumentFolder = {
  key: DocumentFolderKey;
  label: string;
  /** Qué se guarda en la carpeta, en una línea. */
  hint: string;
  /** Tipos que reúne (los de sus subcarpetas si las tiene). */
  kinds: readonly DocumentKind[];
  children?: readonly DocumentFolder[];
};

const RECORD_FOLDERS: readonly DocumentFolder[] = [
  {
    key: "registros-en-blanco",
    label: "Registros en blanco",
    hint: "Formularios vigentes, sin completar, listos para usar.",
    kinds: ["record_blank"],
  },
  {
    key: "registros-en-gestion",
    label: "Registros en gestión",
    hint: "Registros completados que se conservan como evidencia.",
    kinds: ["record_managed"],
  },
];

/** Carpetas de primer nivel, en el orden en que se muestran. */
export const DOCUMENT_FOLDERS: readonly DocumentFolder[] = [
  {
    key: "manual",
    label: "Manual",
    hint: "Manual del Sistema de Gestión: alcance, procesos y cómo se cumple la norma.",
    kinds: ["manual"],
  },
  {
    key: "politicas",
    label: "Políticas",
    hint: "Políticas aprobadas por la dirección.",
    kinds: ["policy"],
  },
  {
    key: "registros",
    label: "Registros",
    hint: "Formularios en blanco y registros completados.",
    kinds: ["record_blank", "record_managed"],
    children: RECORD_FOLDERS,
  },
  {
    key: "procedimientos",
    label: "Procedimientos",
    hint: "Procedimientos e instructivos de cada proceso.",
    kinds: ["procedure"],
  },
];

export function isDocumentKind(value: string): value is DocumentKind {
  return (DOCUMENT_KINDS as readonly string[]).includes(value);
}

/** Un valor desconocido (anterior a las carpetas) cae en el valor por defecto de la columna. */
export function documentKindOf(value: string): DocumentKind {
  return isDocumentKind(value) ? value : "procedure";
}

export function findDocumentFolder(key: string | undefined | null): DocumentFolder | null {
  if (!key) return null;
  for (const folder of DOCUMENT_FOLDERS) {
    if (folder.key === key) return folder;
    const child = folder.children?.find((c) => c.key === key);
    if (child) return child;
  }
  return null;
}

/** Carpeta de primer nivel que contiene a `key` (ella misma si ya es de primer nivel). */
export function parentDocumentFolder(key: DocumentFolderKey): DocumentFolder | null {
  return (
    DOCUMENT_FOLDERS.find(
      (folder) => folder.key === key || folder.children?.some((c) => c.key === key),
    ) ?? null
  );
}

export function documentsInFolder<T extends { kind: string }>(
  documents: readonly T[],
  folder: DocumentFolder,
): T[] {
  return documents.filter((doc) => folder.kinds.includes(documentKindOf(doc.kind)));
}
