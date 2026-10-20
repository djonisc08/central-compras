"use client";

import { useTransition } from "react";
import Link from "next/link";
import { MoreHorizontalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { excluirPropostaAction } from "@/server/actions/requisicoes";

export function PropostaAcoes({ requisicaoId, propostaId, fornecedorId }: { requisicaoId: number; propostaId: number; fornecedorId: number }) {
  const [, iniciar] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Ações da proposta">
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem asChild>
          <Link href={`/requisicoes/${requisicaoId}/proposta?fornecedor=${fornecedorId}`}>
            <PencilIcon /> Editar
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          destrutivo
          onSelect={() => {
            if (!confirm("Excluir esta proposta?")) return;
            iniciar(async () => {
              const r = await excluirPropostaAction(propostaId);
              if (r.ok) toast.success("Proposta excluída");
              else toast.error(r.erro);
            });
          }}
        >
          <Trash2Icon /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
