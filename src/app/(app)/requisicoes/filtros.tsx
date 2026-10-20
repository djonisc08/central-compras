"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FlameIcon, SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROTULO_REQUISICAO } from "@/components/status";
import { STATUS_REQUISICAO } from "@/db/schema";
import { cn } from "@/lib/utils";

export function FiltrosRequisicoes({ obras }: { obras: { id: number; nome: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(sp.get("q") ?? "");

  function definir(chave: string, valor: string | null) {
    const p = new URLSearchParams(sp.toString());
    if (valor) p.set(chave, valor);
    else p.delete(chave);
    iniciar(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== busca) definir("q", busca || null);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const urgente = sp.get("urgente") === "1";

  return (
    <div className={cn("flex flex-col gap-2 transition-opacity sm:flex-row sm:flex-wrap", pendente && "opacity-70")}>
      <div className="relative flex-1 sm:min-w-64">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar nº, material ou solicitante" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Select value={sp.get("obra") ?? "todas"} onValueChange={(v) => definir("obra", v === "todas" ? null : v)}>
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as obras</SelectItem>
            {obras.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sp.get("status") ?? "em_andamento"} onValueChange={(v) => definir("status", v === "em_andamento" ? null : v)}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectSeparator />
            {STATUS_REQUISICAO.map((s) => (
              <SelectItem key={s} value={s}>
                {ROTULO_REQUISICAO[s].rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        onClick={() => definir("urgente", urgente ? null : "1")}
        className={cn(
          "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-[13px] font-medium shadow-xs transition-colors",
          urgente ? "border-st-urgente/40 bg-st-urgente-bg text-st-urgente" : "bg-card text-muted-foreground hover:text-foreground",
        )}
        aria-pressed={urgente}
      >
        <FlameIcon className="size-4" /> Só urgentes
      </button>
    </div>
  );
}
