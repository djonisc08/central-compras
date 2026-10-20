"use client";

import { useTransition } from "react";
import { BanIcon, FlameIcon, MoreHorizontalIcon, PrinterIcon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StatusRequisicao } from "@/db/schema";
import {
  atualizarRequisicaoAction,
  cancelarRequisicaoAction,
  reabrirRequisicaoAction,
} from "@/server/actions/requisicoes";

export function AcoesRequisicao({
  id,
  status,
  urgente,
}: {
  id: number;
  status: StatusRequisicao;
  urgente: boolean;
  dataNecessidade: string;
}) {
  const [pendente, iniciar] = useTransition();
  const rodar = (fn: () => Promise<{ ok: boolean; erro?: string }>, msg: string) =>
    iniciar(async () => {
      const r = await fn();
      if (r.ok) toast.success(msg);
      else toast.error(r.erro ?? "Erro");
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={pendente} aria-label="Mais ações">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <a href={`/imprimir/mapa/${id}`} target="_blank" rel="noreferrer">
            <PrinterIcon /> Imprimir mapa
          </a>
        </DropdownMenuItem>
        {status !== "cancelada" && status !== "entregue" && (
          <DropdownMenuItem onSelect={() => rodar(() => atualizarRequisicaoAction(id, { urgente: !urgente }), urgente ? "Urgência removida" : "Marcada como urgente")}>
            <FlameIcon /> {urgente ? "Remover urgência" : "Marcar como urgente"}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {status === "cancelada" ? (
          <DropdownMenuItem onSelect={() => rodar(() => reabrirRequisicaoAction(id), "Requisição reaberta")}>
            <RotateCcwIcon /> Reabrir
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            destrutivo
            onSelect={() => {
              if (confirm("Cancelar esta requisição?")) rodar(() => cancelarRequisicaoAction(id), "Requisição cancelada");
            }}
          >
            <BanIcon /> Cancelar requisição
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
