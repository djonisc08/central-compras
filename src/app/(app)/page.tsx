import Link from "next/link";
import { connection } from "next/server";
import { AlertTriangleIcon, ArrowRightIcon, CalendarDaysIcon, ClipboardPasteIcon, FileBarChartIcon, ClipboardListIcon, FlameIcon, StampIcon, TruckIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { entregasPendentes, gastoPorObraNoPeriodo, resumoOperacional } from "@/server/dados/painel";
import { listarRequisicoes, podeExcluirRequisicao } from "@/server/dados/requisicoes";
import { CancelarRequisicao } from "@/components/cancelar-requisicao";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { StatusRequisicaoBadge, UrgenteBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Vazio } from "@/components/vazio";
import { diasEntre, fimDoMes, formatarData, formatarMes, hojeISO, inicioDoMes, prazoRelativo } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { SeletorDia } from "./dia/seletor-dia";

export default async function PainelPage() {
  await connection();
  const db = getDb();
  const hoje = hojeISO();
  const r = resumoOperacional(db, hoje);
  const fila = listarRequisicoes(db, { status: "em_andamento" }).slice(0, 8);
  const entregas = entregasPendentes(db);
  const gasto = gastoPorObraNoPeriodo(db, inicioDoMes(hoje), fimDoMes(hoje));
  const maxGasto = Math.max(1, ...gasto.map((g) => g.total));
  const totalMes = gasto.reduce((s, g) => s + g.total, 0);

  return (
    <>
      <PageHeader
        titulo="Painel"
        descricao={new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${hoje}T12:00:00`))}
        acoes={
          <>
          <SeletorDia de={hoje} ate={hoje} compacto />
          <Button variant="outline" asChild>
            <Link href="/dia">
              <CalendarDaysIcon /> Meu dia
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <a href={`/imprimir/relatorio?mes=${hoje.slice(0, 7)}`} target="_blank" rel="noreferrer">
              <FileBarChartIcon /> Relatório do mês
            </a>
          </Button>
          <Button asChild>
            <Link href="/requisicoes/nova?colar=1">
              <ClipboardPasteIcon /> Colar pedido do WhatsApp
            </Link>
          </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Link href="/requisicoes?status=cotando" className="rounded-xl transition-shadow hover:shadow-md">
          <KpiCard rotulo="Em cotação" icone={<ClipboardListIcon />} tom="info" valor={r.emCotacao} detalhe={`${r.semProposta} ainda sem proposta`} />
        </Link>
        <Link href="/requisicoes?urgente=1" className="rounded-xl transition-shadow hover:shadow-md">
          <KpiCard rotulo="Urgentes / até amanhã" icone={<FlameIcon />} tom={r.urgentesHoje ? "urgente" : "neutro"} valor={r.urgentesHoje} detalhe="Requisições em andamento" />
        </Link>
        <Link href="/pedidos?status=aguardando_aprovacao" className="rounded-xl transition-shadow hover:shadow-md">
          <KpiCard rotulo="Aguardando aprovação" icone={<StampIcon />} tom={r.aguardandoAprovacao ? "atencao" : "neutro"} valor={r.aguardandoAprovacao} detalhe="Pedidos para aprovar" />
        </Link>
        <Link href="/pedidos?status=atrasados" className="rounded-xl transition-shadow hover:shadow-md">
        <KpiCard
          rotulo="Entregas atrasadas"
          icone={<TruckIcon />}
          tom={r.entregasAtrasadas ? "urgente" : "ok"}
          valor={r.entregasAtrasadas}
          detalhe={`${r.entregasHoje} previstas para hoje`}
        />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-5">
        <Card className="min-w-0 lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Fila de compras</CardTitle>
              <CardDescription>Urgentes primeiro, depois pela data de necessidade.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/requisicoes">
                Ver todas <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-1 px-2 pb-2">
            {fila.length === 0 && <Vazio titulo="Nada pendente" descricao="Todas as requisições foram atendidas." />}
            {fila.map((q) => {
              const d = diasEntre(hoje, q.dataNecessidade);
              return (
                <div key={q.id} className="group flex items-center gap-1 rounded-lg pr-1 transition-colors hover:bg-muted">
                <Link href={q.qtdPropostas ? `/requisicoes/${q.id}/mapa` : `/requisicoes/${q.id}`} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="tabular shrink-0 text-xs text-muted-foreground">#{q.id}</span>
                      <span className="truncate text-[13.5px] font-medium">{q.resumoItens}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{q.obra}</span>
                      <span>·</span>
                      <span>{q.qtdPropostas} propostas</span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <StatusRequisicaoBadge status={q.status} />
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    {q.urgente && <UrgenteBadge className="mb-0.5" />}
                    <div className={cn("text-xs font-medium", d < 0 ? "text-st-urgente" : d <= 1 ? "text-st-atencao" : "text-muted-foreground")}>
                      {prazoRelativo(q.dataNecessidade, hoje)}
                    </div>
                  </div>
                </Link>
                <CancelarRequisicao id={q.id} resumo={`${q.obra} · ${q.resumoItens}`} podeExcluir={podeExcluirRequisicao(db, q.id)} variante="icone" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid min-w-0 content-start gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Entregas pendentes</CardTitle>
                <CardDescription>Pedidos emitidos aguardando material na obra.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-1 px-2 pb-2">
              {entregas.length === 0 && <p className="px-3 pb-3 text-[13px] text-muted-foreground">Nenhuma entrega pendente.</p>}
              {entregas.slice(0, 6).map((e) => {
                const atraso = diasEntre(e.prazo_prometido, hoje);
                return (
                  <Link key={e.id} href={`/pedidos/${e.id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted">
                    {atraso > 0 ? <AlertTriangleIcon className="size-4 shrink-0 text-st-urgente" /> : <TruckIcon className="size-4 shrink-0 text-muted-foreground" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{e.fornecedor}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {e.numero} · {e.obra}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className={cn("font-medium", atraso > 0 ? "text-st-urgente" : atraso === 0 ? "text-st-atencao" : "")}>
                        {atraso > 0 ? `${atraso}d atraso` : prazoRelativo(e.prazo_prometido, hoje)}
                      </div>
                      <div className="text-muted-foreground">{formatarData(e.prazo_prometido)}</div>
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Gasto por obra · {formatarMes(hoje.slice(0, 7))}</CardTitle>
                <CardDescription>Pedidos emitidos no mês: {formatarReais(totalMes)}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              {gasto.map((g) => (
                <div key={g.obra}>
                  <div className="mb-1 flex justify-between gap-2 text-[13px]">
                    <span className="truncate">{g.obra}</span>
                    <span className="tabular font-medium">{formatarReais(g.total)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-chart-1" style={{ width: `${(g.total / maxGasto) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
