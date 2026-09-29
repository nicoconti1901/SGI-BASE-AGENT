import { describe, expect, it } from "vitest";
import { findingDescription, parseProposals } from "@/domain/audits/extraction";

describe("parseProposals", () => {
  it("keeps valid proposals and normalizes text", () => {
    const [p] = parseProposals([
      {
        kind: "nc_minor",
        clause: " 8.4.1 ",
        title: "  Evaluación   de proveedores ",
        description: "No se evalúa a proveedores críticos",
        quote: "No se evidenció evaluación",
        page: 4,
      },
    ]);
    expect(p).toMatchObject({ kind: "nc_minor", clause: "8.4.1", title: "Evaluación de proveedores", page: 4 });
  });

  it("drops entries with an unknown kind, no title or no description", () => {
    expect(
      parseProposals([
        { kind: "strength", title: "Buen trabajo", description: "x" },
        { kind: "observation", title: "", description: "x" },
        { kind: "observation", title: "Sin descripción", description: " " },
        "basura",
        null,
      ]),
    ).toEqual([]);
  });

  it("returns an empty list for non-array input and caps the amount", () => {
    expect(parseProposals({ findings: [] })).toEqual([]);
    const many = Array.from({ length: 100 }, (_, i) => ({
      kind: "observation",
      title: `H${i}`,
      description: "d",
    }));
    expect(parseProposals(many)).toHaveLength(60);
  });

  it("ignores invalid pages", () => {
    const [p] = parseProposals([{ kind: "improvement", title: "t", description: "d", page: -2 }]);
    expect(p.page).toBeNull();
  });
});

describe("findingDescription", () => {
  it("includes clause and quote so the finding can be checked against the report", () => {
    const text = findingDescription({
      kind: "nc_major",
      clause: "7.1.5",
      title: "t",
      description: "Equipos sin calibrar",
      quote: "Equipo 12 sin calibración vigente",
      page: 9,
    });
    expect(text).toContain("Cláusula 7.1.5.");
    expect(text).toContain("Equipos sin calibrar");
    expect(text).toContain("(pág. 9)");
    expect(text).toContain("«Equipo 12 sin calibración vigente»");
  });
});
