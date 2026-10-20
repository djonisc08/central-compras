import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeftIcon, FileSpreadsheetIcon, LandmarkIcon, PlusIcon, PrinterIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarPedidos, previaPedidos } from "@/server/dados/pedidos";
import { obterMapa, temPedidosAtivos, ultimosPrecosPagos } from "@/server/dados/requisicoes";
import { PageHeader } from "@/components/page-header";
import { StatusPedidoBadge, StatusRequisicaoBadge, UrgenteBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Vazio } from "@/components/vazio";
import { formatarData, hojeISO } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { GerarPedidos } from "./gerar-pedidos";
import { MapaComparativo } from "./mapa-comparativo";

export async function generateMetadata({ params }: PageProps<"/requisicoes/[id]/mapa">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Mapa · Requisição #${id}` };
}

export default async function MapaPage({ params }: PageProps<"/requisicoes/[id]/mapa">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const mapa = obterMapa(db, Number(id));
  if (!mapa) notFound();
  const r = mapa.requisicao;
  const ultimos = ultimosPrecosPagos(db, r.itens.map((i) => i.materialId));
  const comPedidos = temPedidosAtivos(db, r.id);
  const editavel = ["aberta", "cotando", "aguardando_aprovacao"].includes(r.status) && !comPedidos;
  const prontoParaPedido = editavel && mapa.resumo.itensComVencedor > 0;
  const semFornecedor = mapa.resumo.linhas.filter((l) => l.propostaEscolhidaId == null).map((l) => l.item.material);
  const previa = prontoParaPedido ? previaPedidos(db, r.id) : [];
  const pedidosDaReq = listarPedidos(db, { requisicaoId: r.id }).filter((p) => p.status !== "cancelado");

  return (
    <>
      <PageHeader
        antes={
          <Link href={`/requisicoes/${r.id}`} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Requisição #{r.id}
          </Link>
        }
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Mapa comparativo
            <StatusRequisicaoBadge status={r.status} />
            {r.urgente && <UrgenteBadge />}
          </span>
        }
        descricao={`${r.obra} · precisa até ${formatarData(r.dataNecessidade)} · ${mapa.propostas.length} propostas`}
        acoes={
          <>
            {editavel && (
              <Button variant="outline" asChild>
                <Link href={`/requisicoes/${r.id}/proposta`}>
                  <PlusIcon /> Proposta
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`/imprimir/mapa/${r.id}`} target="_blank" rel="noreferrer">
                <PrinterIcon /> Imprimir
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/exportar/mapa/${r.id}`}>
                <FileSpreadsheetIcon /> Excel
              </a>
            </Button>
            {pedidosDaReq.length > 0 && (
              <Button variant="outline" asChild>
                <a href={`/imprimir/financeiro/${r.id}`} target="_blank" rel="noreferrer">
                  <LandmarkIcon /> Resumo p/ financeiro
                </a>
              </Button>
            )}
            {prontoParaPedido && <GerarPedidos requisicaoId={r.id} previa={previa} semFornecedor={semFornecedor} />}
          </>
        }
      />
      {pedidosDaReq.length > 0 && (
        <div className="mb-4 rounded-xl border bg-card p-4">
          <div className="mb-2 text-[13px] font-medium">Pedidos desta requisição</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {pedidosDaReq.map((p) => (
              <Link key={p.id} href={`/pedidos/${p.id}`} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 hover:bg-muted">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium">{p.fornecedor}</div>
                  <div className="text-xs text-muted-foreground">{p.numero ?? "sem número (não emitido)"}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusPedidoBadge status={p.status} />
                  <span className="tabular text-xs font-medium">{formatarReais(p.valorTotalCentavos)}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {prontoParaPedido && (
        <div className="mb-4 rounded-xl border border-st-ok/30 bg-st-ok-bg/50 px-4 py-3 text-[13px]">
          {semFornecedor.length === 0 ? (
            <>
              Todos os itens têm fornecedor. Próximo passo: <strong>Fechar e gerar pedido</strong> (botão verde acima), escolhendo à vista ou a prazo.
            </>
          ) : (
            <>
              {mapa.resumo.itensComVencedor} de {mapa.resumo.totalItens} itens fechados. Pode <strong>fechar agora</strong> (botão verde acima): os{" "}
              {semFornecedor.length} sem fornecedor vão para uma requisição de saldo. Ou lance outra proposta para eles antes.
            </>
          )}
        </div>
      )}
      {mapa.propostas.length === 0 ? (
        <Vazio
          titulo="Ainda não há propostas para comparar"
          descricao="Lance pelo menos uma proposta para montar o mapa."
          acao={
            <Button asChild>
              <Link href={`/requisicoes/${r.id}/proposta`}>
                <PlusIcon /> Lançar proposta
              </Link>
            </Button>
          }
        />
      ) : (
        <MapaComparativo
          requisicaoId={r.id}
          editavel={editavel}
          dataNecessidade={r.dataNecessidade}
          hoje={hojeISO()}
          resumo={mapa.resumo}
          ultimos={Object.fromEntries([...ultimos].map(([k, v]) => [k, v.preco]))}
        />
      )}
    </>
  );
}
