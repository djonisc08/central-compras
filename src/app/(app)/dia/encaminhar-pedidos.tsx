"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyIcon, MessageCircleIcon, ReceiptTextIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatarData } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { mensagemRecebimento, type PedidoParaRecebimento } from "@/lib/mensagens";
import { cn } from "@/lib/utils";

export type PedidoDoDia = PedidoParaRecebimento & { id: number; condicaoPagamento: string | null; hora: string | null };

/** Pedidos fechados no período, com seleção para mandar a quem recebe na obra. */
export function EncaminharPedidos({ pedidos, titulo }: { pedidos: PedidoDoDia[]; titulo: string }) {
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set(pedidos.map((p) => p.id)));
  const [comValores, setComValores] = useState(false);
  const escolhidos = pedidos.filter((p) => marcados.has(p.id));
  const texto = mensagemRecebimento(escolhidos, { titulo, comValores });

  const alternar = (id: number, ligar: boolean) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (ligar) n.add(id);
      else n.delete(id);
      return n;
    });

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Resumo copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="grid gap-2">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border-2 border-primary/40 bg-card px-3 py-2.5">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
          <Checkbox
            checked={escolhidos.length === pedidos.length ? true : escolhidos.length ? "indeterminate" : false}
            onCheckedChange={(v) => setMarcados(v === true ? new Set(pedidos.map((p) => p.id)) : new Set())}
          />
          {escolhidos.length} de {pedidos.length} selecionados
        </label>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={comValores} onCheckedChange={setComValores} /> Incluir valores
        </label>
        <Button variant="outline" size="sm" onClick={copiar} disabled={!escolhidos.length}>
          <CopyIcon /> Copiar
        </Button>
        <Button size="sm" asChild disabled={!escolhidos.length}>
          <a
            href={escolhidos.length ? `https://wa.me/?text=${encodeURIComponent(texto)}` : undefined}
            target="_blank"
            rel="noreferrer"
            aria-disabled={!escolhidos.length}
            className={cn(!escolhidos.length && "pointer-events-none opacity-50")}
          >
            <MessageCircleIcon /> Encaminhar no WhatsApp
          </a>
        </Button>
      </div>

      <ul className="grid gap-1">
        {pedidos.map((p) => (
          <li key={p.id}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted",
                marcados.has(p.id) && "bg-accent/40",
              )}
            >
              <Checkbox className="mt-1" checked={marcados.has(p.id)} onCheckedChange={(v) => alternar(p.id, v === true)} />
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-st-ok/12 text-st-ok [&_svg]:size-4">
                <ReceiptTextIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">
                  {p.numero ?? "Pedido"} · {p.fornecedor}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {p.obra}
                  {p.condicaoPagamento && <> · {p.condicaoPagamento}</>}
                  {p.prazoPrometido && <> · entrega {formatarData(p.prazoPrometido)}</>}
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {p.itens.map((i) => i.material).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="tabular block text-[13px] font-medium">{formatarReais(p.valorTotalCentavos)}</span>
                <Link href={`/pedidos/${p.id}`} className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                  abrir
                </Link>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
