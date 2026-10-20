import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ReceiptTextIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { STATUS_PEDIDO, type StatusPedido } from "@/db/schema";
import { listarObras } from "@/server/dados/cadastros";
import { listarPedidos, type FiltroPedidos } from "@/server/dados/pedidos";
import { PageHeader } from "@/components/page-header";
import { StatusPedidoBadge, UrgenteBadge } from "@/components/status";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vazio } from "@/components/vazio";
import { diasEntre, formatarData, hojeISO } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { FiltrosPedidos } from "./filtros";

export const metadata: Metadata = { title: "Pedidos" };

export default async function PedidosPage({ searchParams }: PageProps<"/pedidos">) {
  await connection();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const s = str("status");
  const status: FiltroPedidos["status"] =
    s === "todos" ? undefined : s === "atrasados" ? "atrasados" : s && (STATUS_PEDIDO as readonly string[]).includes(s) ? (s as StatusPedido) : "em_aberto";

  const db = getDb();
  const hoje = hojeISO();
  const requisicaoId = Number(str("requisicao")) || undefined;
  const lista = listarPedidos(db, { status: requisicaoId ? undefined : status, obraId: Number(str("obra")) || undefined, requisicaoId, busca: str("q") }, hoje);
  const total = lista.reduce((acc, p) => acc + (p.status === "cancelado" ? 0 : p.valorTotalCentavos), 0);

  return (
    <>
      <PageHeader
        titulo="Pedidos de compra"
        descricao={requisicaoId ? `Pedidos da requisição #${requisicaoId}` : "Aprovação, emissão e acompanhamento de entrega."}
      />
      <FiltrosPedidos obras={listarObras(db).map((o) => ({ id: o.id, nome: o.nome }))} />

      {lista.length === 0 ? (
        <Vazio
          icone={<ReceiptTextIcon />}
          titulo="Nenhum pedido com esses filtros"
          descricao="Pedidos nascem no mapa comparativo, depois que todos os itens têm vencedor."
          className="mt-4"
        />
      ) : (
        <>
          <div className="mt-4 grid gap-2 md:hidden">
            {lista.map((p) => (
              <Link key={p.id} href={`/pedidos/${p.id}`} className="rounded-xl border bg-card p-3.5 active:bg-muted">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      {p.numero ?? "Sem número"} · {p.obra}
                    </div>
                    <div className="mt-0.5 truncate text-[13.5px] font-medium">{p.fornecedor}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.resumoItens}</div>
                  </div>
                  <div className="tabular shrink-0 text-right text-[13.5px] font-semibold">{formatarReais(p.valorTotalCentavos)}</div>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <StatusPedidoBadge status={p.status} />
                  <Prazo p={p} hoje={hoje} />
                </div>
              </Link>
            ))}
          </div>

          <Card className="mt-4 hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Pedido</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((p) => (
                  <TableRow key={p.id} className="group relative">
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/pedidos/${p.id}`} className="font-medium after:absolute after:inset-0 group-hover:text-primary">
                        {p.numero ?? <span className="text-muted-foreground">Rascunho #{p.id}</span>}
                      </Link>
                      <div className="text-xs text-muted-foreground">Req. #{p.requisicaoId}</div>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="flex items-center gap-2 font-medium">
                        {p.urgente && <UrgenteBadge />}
                        <span className="truncate">{p.fornecedor}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{p.resumoItens}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{p.obra}</TableCell>
                    <TableCell className="tabular text-right">
                      <div className="font-medium">{formatarReais(p.valorTotalCentavos)}</div>
                      <div className="text-xs text-muted-foreground">{p.formaPagamento === "avista" ? "à vista" : p.condicaoPagamento}</div>
                    </TableCell>
                    <TableCell>
                      <Prazo p={p} hoje={hoje} />
                    </TableCell>
                    <TableCell>
                      <StatusPedidoBadge status={p.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            {lista.length} pedidos · {formatarReais(total)}
          </p>
        </>
      )}
    </>
  );
}

function Prazo({ p, hoje }: { p: { status: string; prazoPrometido: string | null; ultimaEntrega: string | null }; hoje: string }) {
  if (p.status === "entregue") {
    const atraso = p.prazoPrometido && p.ultimaEntrega ? diasEntre(p.prazoPrometido, p.ultimaEntrega) : 0;
    return (
      <div className="text-[13px] leading-tight">
        {formatarData(p.ultimaEntrega)}
        <div className={cn("text-[11.5px] font-medium", atraso > 0 ? "text-st-urgente" : "text-st-ok")}>{atraso > 0 ? `${atraso}d de atraso` : "no prazo"}</div>
      </div>
    );
  }
  if (!p.prazoPrometido) return <span className="text-xs text-muted-foreground">após emissão</span>;
  const d = diasEntre(hoje, p.prazoPrometido);
  return (
    <div className="text-[13px] leading-tight">
      {formatarData(p.prazoPrometido)}
      <div className={cn("text-[11.5px] font-medium", d < 0 ? "text-st-urgente" : d <= 1 ? "text-st-atencao" : "text-muted-foreground")}>
        {d < 0 ? `${-d}d de atraso` : d === 0 ? "chega hoje" : d === 1 ? "amanhã" : `em ${d} dias`}
      </div>
    </div>
  );
}
