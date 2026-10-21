"use client";

import { Button } from "@/components/ui";
import { recordPrintAction } from "@/app/(tenant)/t/[slug]/suppliers/actions";

export function PrintButton({ slug }: { slug: string }) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await recordPrintAction(slug);
        window.print();
      }}
    >
      Imprimir
    </Button>
  );
}
