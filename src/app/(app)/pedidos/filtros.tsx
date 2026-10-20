"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const ABAS = [
  { valor: "em_aberto", rotulo: "Em aberto" },
  { valor: "aguardando_aprovacao", rotulo: "Aguardando aprovação" },
  { valor: "atrasados", rotulo: "Atrasados" },
  { valor: "entregue", rotulo: "Entregues" },
  { valor: "todos", rotulo: "Todos" },
];

export function FiltrosPedidos({ obras }: { obras: { id: number; nome: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, iniciar] = useTransition();
  const [busca, setBusca] = useState(sp.get("q") ?? "");
  const status = sp.get("status") ?? "em_aberto";

  function definir(chave: string, valor: string | null) {
    const p = new URLSearchParams(sp.toString());
    p.delete("requisicao");
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

  return (
    <div className={cn("grid gap-2 transition-opacity", pendente && "opacity-70")}>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            onClick={() => definir("status", a.valor === "em_aberto" ? null : a.valor)}
            className={cn(
              "h-8 shrink-0 cursor-pointer rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              status === a.valor && !sp.get("requisicao") ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar nº do pedido, fornecedor ou requisição" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
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
      </div>
    </div>
  );
}
