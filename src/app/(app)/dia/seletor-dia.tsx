"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarSearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Escolher um dia ou intervalo (de/até) para a tela "Meu dia". */
export function SeletorDia({ de, ate, compacto }: { de: string; ate: string; compacto?: boolean }) {
  const router = useRouter();
  const [ini, setIni] = useState(de);
  const [fim, setFim] = useState(ate);
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ini) return;
        router.push(`/dia?de=${ini}&ate=${fim && fim >= ini ? fim : ini}`);
      }}
    >
      <Input type="date" value={ini} onChange={(e) => setIni(e.target.value)} className="h-8 w-[9.5rem]" aria-label="De" />
      {!compacto && (
        <>
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="h-8 w-[9.5rem]" aria-label="Até" />
        </>
      )}
      <Button type="submit" size="sm" variant="outline">
        <CalendarSearchIcon /> Ver
      </Button>
    </form>
  );
}
