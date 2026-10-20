"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { gerarPedidosAction } from "@/server/actions/pedidos";
import type { PreviaPedido } from "@/server/dados/pedidos";

export function GerarPedidos({ requisicaoId, previa }: { requisicaoId: number; previa: PreviaPedido[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  // Padrão: à vista quando há desconto (é o que costuma valer a pena).
  const [formas, setFormas] = useState<Record<string, "prazo" | "avista">>(() =>
    Object.fromEntries(previa.map((p) => [String(p.propostaId), p.totalAVista != null ? "avista" : "prazo"])),
  );

  const total = previa.reduce((s, p) => s + (formas[String(p.propostaId)] === "avista" && p.totalAVista != null ? p.totalAVista : p.totalPrazo), 0);

  function gerar() {
    iniciar(async () => {
      const r = await gerarPedidosAction({ requisicaoId, formas });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(r.dados.length === 1 ? "Pedido gerado: aguardando aprovação" : `${r.dados.length} pedidos gerados: aguardando aprovação`);
      setAberto(false);
      router.push(r.dados.length === 1 ? `/pedidos/${r.dados[0]}` : `/pedidos?requisicao=${requisicaoId}`);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button size="lg" variant="sucesso">
          <FileCheck2Icon /> Gerar {previa.length === 1 ? "pedido" : `${previa.length} pedidos`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar pedido de compra</DialogTitle>
          <DialogDescription>Um pedido por fornecedor vencedor. Escolha a forma de pagamento; os pedidos ficam aguardando aprovação.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {previa.map((p) => {
            const chave = String(p.propostaId);
            const forma = formas[chave];
            return (
              <div key={p.propostaId} className="rounded-lg border p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium">{p.fornecedor}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.itens.length} {p.itens.length === 1 ? "item" : "itens"} · prazo {p.prazoEntregaDias ?? "—"} dia(s)
                  </div>
                </div>
                <ul className="mt-1.5 text-xs text-muted-foreground">
                  {p.itens.map((i) => (
                    <li key={i.requisicaoItemId} className="truncate">
                      {formatarNumero(i.quantidade)} {i.unidade} · {i.material}
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                  <Opcao
                    ativo={forma === "prazo"}
                    onClick={() => setFormas((f) => ({ ...f, [chave]: "prazo" }))}
                    titulo={`A prazo · ${p.condicaoPagamento ?? "conforme proposta"}`}
                    valor={formatarReais(p.totalPrazo)}
                  />
                  <Opcao
                    ativo={forma === "avista"}
                    desabilitado={p.totalAVista == null}
                    onClick={() => setFormas((f) => ({ ...f, [chave]: "avista" }))}
                    titulo={p.totalAVista != null ? `À vista · −${formatarPercentual(p.descontoAVistaBp / 10000)}` : "À vista · sem desconto informado"}
                    valor={p.totalAVista != null ? formatarReais(p.totalAVista) : "—"}
                    detalhe={p.totalAVista != null ? `economiza ${formatarReais(p.totalPrazo - p.totalAVista)}` : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <div className="text-[13px]">
            Total dos pedidos: <span className="tabular font-semibold">{formatarReais(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={gerar} disabled={pendente}>
              {pendente ? "Gerando…" : "Gerar e enviar para aprovação"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Opcao({
  ativo,
  desabilitado,
  onClick,
  titulo,
  valor,
  detalhe,
}: {
  ativo: boolean;
  desabilitado?: boolean;
  onClick: () => void;
  titulo: string;
  valor: string;
  detalhe?: string;
}) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      onClick={onClick}
      aria-pressed={ativo}
      className={cn(
        "flex cursor-pointer flex-col items-start rounded-md border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        ativo ? "border-primary bg-accent ring-1 ring-primary" : "hover:bg-muted",
      )}
    >
      <span className="text-xs text-muted-foreground">{titulo}</span>
      <span className="tabular text-[15px] font-semibold">{valor}</span>
      {detalhe && <span className="text-[11px] font-medium text-st-ok">{detalhe}</span>}
    </button>
  );
}
