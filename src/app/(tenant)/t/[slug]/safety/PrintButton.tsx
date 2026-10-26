"use client";

import { Button } from "@/components/ui";

export function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <Button type="button" variant="secondary" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
