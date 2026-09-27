import { NextResponse } from "next/server";
import { scanDueReminders } from "@/lib/automation";
import { verifyAutomationSecret } from "@/lib/automation-webhook";

/**
 * Disparador externo del motor de vencimientos (n8n Schedule Trigger).
 * Idempotente: cada DueItem se reclama de forma atómica antes de notificar,
 * así que reintentos o llamadas concurrentes no duplican avisos.
 */
export async function POST(request: Request) {
  const check = verifyAutomationSecret(
    request.headers.get("authorization"),
    process.env.AUTOMATION_WEBHOOK_SECRET,
  );
  if (check === "not_configured") {
    console.error(
      JSON.stringify({ event: "automation.scan.rejected", reason: check }),
    );
    return NextResponse.json({ error: "No configurado" }, { status: 503 });
  }
  if (check !== "ok") {
    console.warn(
      JSON.stringify({ event: "automation.scan.rejected", reason: check }),
    );
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const result = await scanDueReminders();
    console.info(
      JSON.stringify({
        event: "automation.scan.succeeded",
        runId: result.runId,
        scanned: result.scanned,
        reminded: result.reminded,
        durationMs: Date.now() - startedAt,
      }),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "automation.scan.failed",
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt,
      }),
    );
    return NextResponse.json({ error: "Falló el scan" }, { status: 500 });
  }
}
