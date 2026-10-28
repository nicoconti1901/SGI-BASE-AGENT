import { prisma } from "../../src/lib/db";
import { cuitCheckDigit } from "../../src/domain/suppliers/cuit";

/** Contraseña común de todos los usuarios de demo. */
export const DEMO_PASSWORD = "Demo123!demo";
export const DEMO_DOMAIN = "demo.sgi.test";

/** PDF mínimo válido, para adjuntos y certificados de prueba. */
export function demoPdf(title: string): Buffer {
  const safeTitle = title.replace(/[^A-Za-z0-9 .,-]/g, "");
  const text = `BT /F1 18 Tf 72 720 Td (${safeTitle} - documento de prueba) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** PNG de 1x1 píxel (foto de prueba válida). */
export const DEMO_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export type Step = { label: string; ok: boolean; error?: string };
const steps: Step[] = [];

/** Ejecuta un paso del seed: si falla lo anota y sigue, para no perder el resto de los datos. */
export async function step<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await fn();
    steps.push({ label, ok: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    steps.push({ label, ok: false, error: message });
    console.warn(`  ✗ ${label}: ${message.slice(0, 300)}`);
    return undefined;
  }
}

export function stepReport() {
  const failed = steps.filter((s) => !s.ok);
  console.log(`\nPasos: ${steps.length - failed.length} bien, ${failed.length} con error`);
  for (const f of failed) console.log(` - ${f.label}: ${f.error?.slice(0, 200)}`);
}

export type Member = { userId: string; name: string; email: string; personId?: string };

/** Lo que cada módulo necesita saber de la empresa que se está cargando. */
export type DemoTenant = {
  id: string;
  slug: string;
  name: string;
  users: Record<string, Member>;
  siteIds: Record<string, string>;
  positionIds: Record<string, string>;
  taskIds: Record<string, string>;
  people: { id: string; name: string; code: string; site: string; position: string; employer: "own" | "contractor" }[];
};

export const db = prisma;

/** Elige de a uno, rotando: datos variados sin azar (el seed da siempre lo mismo). */
export function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length];
}

/** CUIT válido: toma el primer número libre a partir de `body` cuyo dígito verificador existe. */
export function cuit(prefix: string, body: number): string {
  for (let n = body; ; n++) {
    const base = `${prefix}${String(n).padStart(8, "0")}`;
    const digit = cuitCheckDigit(base);
    if (digit !== null) return `${base}${digit}`;
  }
}
