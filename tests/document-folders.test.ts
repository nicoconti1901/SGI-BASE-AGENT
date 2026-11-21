import { describe, expect, it } from "vitest";
import {
  DOCUMENT_FOLDERS,
  DOCUMENT_KINDS,
  documentKindOf,
  documentsInFolder,
  findDocumentFolder,
  parentDocumentFolder,
} from "@/domain/documents/folders";

describe("carpetas de documentos", () => {
  it("tiene Manual, Políticas, Registros (en blanco y en gestión) y Procedimientos", () => {
    expect(DOCUMENT_FOLDERS.map((f) => f.label)).toEqual([
      "Manual",
      "Políticas",
      "Registros",
      "Procedimientos",
    ]);
    expect(findDocumentFolder("registros")?.children?.map((f) => f.label)).toEqual([
      "Registros en blanco",
      "Registros en gestión",
    ]);
  });

  it("cada tipo de documento cae en exactamente una carpeta hoja", () => {
    const leaves = DOCUMENT_FOLDERS.flatMap((f) => f.children ?? [f]);
    for (const kind of DOCUMENT_KINDS) {
      expect(leaves.filter((leaf) => leaf.kinds.includes(kind))).toHaveLength(1);
    }
  });

  it("Registros reúne lo de sus dos subcarpetas", () => {
    const docs = [
      { id: "a", kind: "record_blank" },
      { id: "b", kind: "record_managed" },
      { id: "c", kind: "procedure" },
    ];
    expect(documentsInFolder(docs, findDocumentFolder("registros")!).map((d) => d.id)).toEqual(["a", "b"]);
    expect(documentsInFolder(docs, findDocumentFolder("registros-en-gestion")!).map((d) => d.id)).toEqual(["b"]);
  });

  it("un tipo desconocido se muestra en Procedimientos (valor por defecto de la columna)", () => {
    expect(documentKindOf("otro")).toBe("procedure");
    expect(documentsInFolder([{ kind: "otro" }], findDocumentFolder("procedimientos")!)).toHaveLength(1);
  });

  it("resuelve la carpeta padre y rechaza claves inexistentes", () => {
    expect(parentDocumentFolder("registros-en-blanco")?.key).toBe("registros");
    expect(parentDocumentFolder("manual")?.key).toBe("manual");
    expect(findDocumentFolder("inexistente")).toBeNull();
    expect(findDocumentFolder(undefined)).toBeNull();
  });
});
