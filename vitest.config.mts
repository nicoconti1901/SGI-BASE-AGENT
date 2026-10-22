import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

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
