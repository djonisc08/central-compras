"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BotaoImprimir() {
  return (
    <Button onClick={() => window.print()}>
      <PrinterIcon /> Imprimir / PDF
    </Button>
  );
}
