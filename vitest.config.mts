import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Cada PrismaClient abre por defecto (CPUs × 2 + 1) conexiones, unas 25 en esta máquina. Los tests de integración
// crean uno por archivo y comparten Postgres con el servidor de desarrollo: sin tope se agotan las 100 conexiones.
if (process.env.DATABASE_URL && !/[?&]connection_limit=/.test(process.env.DATABASE_URL)) {
  const url = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `${url}${url.includes("?") ? "&" : "?"}connection_limit=4`;
}

export default defineConfig({
  test: {
    environment: "node",
    // Cada archivo abre su propio PrismaClient; con muchos workers en paralelo
    // Windows cae con 0xC0000409 y Postgres se queda sin conexiones.
    maxWorkers: 4,
    // Los integration tests tocan Postgres real; 5 s por defecto no alcanza con la carga de la suite.
    testTimeout: 30_000,
    include: ["tests/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
});
