"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { cancelarRequisicaoAction, excluirRequisicaoAction } from "@/server/actions/requisicoes";

const MOTIVOS = ["A obra cancelou o pedido", "Não fechou com nenhum fornecedor", "Lançada em duplicidade", "Comprado por fora"];

/** Tirar da frente a cotação que não vai acontecer: cancelar (fica no histórico) ou excluir de vez. */
export function CancelarRequisicao({
  id,
  resumo,
  podeExcluir,
  variante = "botao",
  depois,
}: {
  id: number;
  resumo: string;
  podeExcluir: boolean;
  variante?: "botao" | "icone";
  /** Para onde ir depois (ex.: sair da tela da requisição excluída). */
  depois?: string;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();

  function cancelar() {
    iniciar(async () => {
      const r = await cancelarRequisicaoAction(id, motivo);
      if (!r.ok) return void toast.error(r.erro);
      const n = (r.dados as { pedidosCancelados: number } | undefined)?.pedidosCancelados ?? 0;
      toast.success(`Requisição #${id} cancelada${n ? ` (e ${n} pedido(s) não enviado(s))` : ""}. Saiu da fila.`);
      setAberto(false);
    });
  }

  function excluir() {
    if (!confirm(`Excluir a requisição #${id} de vez? Itens e propostas somem e não dá para desfazer.`)) return;
    iniciar(async () => {
      const r = await excluirRequisicaoAction(id);
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`Requisição #${id} excluída`);
      setAberto(false);
      if (depois) router.push(depois);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {variante === "icone" ? (
          <button
            type="button"
            className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted-foreground opacity-60 transition hover:bg-st-urgente-bg hover:text-st-urgente hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Cancelar a requisição #${id}`}
            title="Cancelar / tirar da fila"
          >
            <XIcon className="size-4" />
          </button>
        ) : (
          <Button variant="outline" className="text-st-urgente hover:text-st-urgente">
            <BanIcon /> Cancelar cotação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Cancelar a requisição #{id}?</DialogTitle>
          <DialogDescription className="line-clamp-2">{resumo}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <div className="text-[13px] font-medium">Motivo</div>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors",
                  motivo === m ? "border-marca-preto bg-marca-preto text-white" : "hover:border-marca-preto/40",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ou escreva o motivo…" />
          <p className="text-xs text-muted-foreground">
            Cancelar tira da fila e do painel, mas guarda o histórico (aparece em Requisições → Canceladas e dá para reabrir). Pedidos ainda não
            enviados ao fornecedor são cancelados junto.
          </p>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {podeExcluir ? (
            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-st-urgente" onClick={excluir} disabled={pendente}>
              <Trash2Icon /> Excluir de vez
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Voltar
            </Button>
            <Button type="button" variant="destructive" onClick={cancelar} disabled={pendente}>
              {pendente ? "Cancelando…" : "Cancelar requisição"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
