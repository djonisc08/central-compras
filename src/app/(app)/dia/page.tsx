import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  BanIcon,
  ClipboardListIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  ReceiptTextIcon,
  StampIcon,
  StarIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import { getDb } from "@/db/client";
import { atividadesNoPeriodo, resumirAtividades, type TipoAtividade } from "@/server/dados/atividades";
import { KpiCard } from "@/components/kpi-card";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Vazio } from "@/components/vazio";
import { formatarData, hojeISO, inicioDoMes, somarDias } from "@/lib/datas";
import { formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { obterPedido } from "@/server/dados/pedidos";
import { EncaminharPedidos } from "./encaminhar-pedidos";
import { SeletorDia } from "./seletor-dia";

export const metadata: Metadata = { title: "Meu dia" };

const ICONES: Record<TipoAtividade, { icone: LucideIcon; cor: string; rotulo: string }> = {
  requisicao: { icone: ClipboardListIcon, cor: "bg-st-info/12 text-st-info", rotulo: "Requisição" },
  proposta: { icone: MessageSquareTextIcon, cor: "bg-muted text-muted-foreground", rotulo: "Orçamento" },
  aprovacao: { icone: StampIcon, cor: "bg-st-atencao/12 text-st-atencao", rotulo: "Aprovação" },
  pedido: { icone: ReceiptTextIcon, cor: "bg-st-ok/12 text-st-ok", rotulo: "Pedido" },
  entrega: { icone: TruckIcon, cor: "bg-st-ok/12 text-st-ok", rotulo: "Entrega" },
  avaliacao: { icone: StarIcon, cor: "bg-muted text-muted-foreground", rotulo: "Avaliação" },
  cancelamento: { icone: BanIcon, cor: "bg-st-urgente/12 text-st-urgente", rotulo: "Cancelado" },
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const ABAS = [
  { chave: "tudo", rotulo: "Tudo", tipos: null },
  { chave: "requisicoes", rotulo: "Requisições", tipos: ["requisicao"] },
  { chave: "cotacoes", rotulo: "Cotações", tipos: ["proposta"] },
  { chave: "pedidos", rotulo: "Pedidos fechados", tipos: ["aprovacao", "pedido", "entrega", "avaliacao", "cancelamento"] },
] as const satisfies readonly { chave: string; rotulo: string; tipos: readonly TipoAtividade[] | null }[];
const diaSemana = (d: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(new Date(`${d}T12:00:00`));

export default async function DiaPage({ searchParams }: PageProps<"/dia">) {
  await connection();
  const sp = await searchParams;
  const hoje = hojeISO();
  const de = typeof sp.de === "string" && ISO.test(sp.de) ? sp.de : hoje;
  const ate = typeof sp.ate === "string" && ISO.test(sp.ate) && sp.ate >= de ? sp.ate : de;
  const todas = atividadesNoPeriodo(getDb(), de, ate);
  const r = resumirAtividades(todas);
  const aba = ABAS.find((a) => a.chave === sp.aba) ?? ABAS[0];
  const daAba = (a: (typeof ABAS)[number]) => (a.tipos ? todas.filter((x) => (a.tipos as readonly string[]).includes(x.tipo)) : todas);
  const naAba = daAba(aba);
  // Na aba de pedidos, os pedidos emitidos ganham seleção para encaminhar a quem recebe na obra.
  const pedidosDoDia =
    aba.chave === "pedidos"
      ? naAba
          .filter((a) => a.tipo === "pedido")
          .map((a) => ({ hora: a.hora, p: obterPedido(getDb(), Number(a.link.split("/").pop())) }))
          .filter((x) => x.p != null)
          .map(({ hora, p }) => ({
            id: p!.id,
            hora,
            numero: p!.numero,
            fornecedor: p!.fornecedor,
            fornecedorContato: p!.fornecedorContato,
            fornecedorWhatsapp: p!.fornecedorWhatsapp,
            obra: p!.obra,
            prazoPrometido: p!.prazoPrometido,
            valorTotalCentavos: p!.valorTotalCentavos,
            condicaoPagamento: p!.condicaoPagamento,
            itens: p!.itens.map((i) => ({ quantidade: i.quantidade, unidade: i.unidade, material: i.material })),
          }))
      : [];
  const lista = pedidosDoDia.length ? naAba.filter((a) => a.tipo !== "pedido") : naAba;
  const umDia = de === ate;

  const segunda = somarDias(hoje, -((new Date(`${hoje}T12:00:00`).getDay() + 6) % 7));
  const atalhos = [
    { rotulo: "Hoje", de: hoje, ate: hoje },
    { rotulo: "Ontem", de: somarDias(hoje, -1), ate: somarDias(hoje, -1) },
    { rotulo: "Esta semana", de: segunda, ate: hoje },
    { rotulo: "Este mês", de: inicioDoMes(hoje), ate: hoje },
  ];

  const periodo = umDia ? `${formatarData(de)} (${diaSemana(de)})` : `${formatarData(de)} a ${formatarData(ate)}`;
  const textoZap = [
    `*Compras · ${periodo}*`,
    `${r.requisicoes} requisições · ${r.orcamentos} orçamentos · ${r.pedidos} pedidos (${formatarReais(r.totalComprado)}) · ${r.entregas} entregas`,
    "",
    ...todas
      .filter((a) => a.tipo === "pedido" || a.tipo === "entrega" || a.tipo === "requisicao")
      .map((a) => `• ${umDia ? "" : `${formatarData(a.data).slice(0, 5)} `}${a.titulo} · ${a.obra}${a.valor != null ? ` · ${formatarReais(a.valor)}` : ""}`),
  ].join("\n");

  const porDia = Map.groupBy(lista, (a) => a.data);

  return (
    <>
      <PageHeader
        titulo={umDia ? (de === hoje ? "Meu dia · hoje" : "Meu dia") : "Meu período"}
        descricao={periodo}
        acoes={
          <Button variant="outline" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(textoZap)}`} target="_blank" rel="noreferrer">
              <MessageCircleIcon className="text-st-ok" /> Resumo no WhatsApp
            </a>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {atalhos.map((a) => (
          <Button key={a.rotulo} size="sm" variant={a.de === de && a.ate === ate ? "default" : "outline"} asChild>
            <Link href={`/dia?de=${a.de}&ate=${a.ate}${aba.chave !== "tudo" ? `&aba=${aba.chave}` : ""}`}>{a.rotulo}</Link>
          </Button>
        ))}
        <SeletorDia key={`${de}-${ate}`} de={de} ate={ate} aba={aba.chave} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard rotulo="Comprado" icone={<ReceiptTextIcon />} tom="ok" valor={formatarReais(r.totalComprado)} detalhe={`${r.pedidos} pedido(s) emitido(s)`} />
        <KpiCard rotulo="Requisições" icone={<ClipboardListIcon />} tom="info" valor={r.requisicoes} detalhe="recebidas das obras" />
        <KpiCard rotulo="Orçamentos" icone={<MessageSquareTextIcon />} tom="neutro" valor={r.orcamentos} detalhe="propostas lançadas" />
        <KpiCard
          rotulo="Entregas"
          icone={<TruckIcon />}
          tom={r.alertas ? "urgente" : "neutro"}
          valor={r.entregas}
          detalhe={r.alertas ? `${r.alertas} com atraso/problema` : "recebidas nas obras"}
        />
      </div>

      <nav className="mb-3 flex gap-1 overflow-x-auto border-b" aria-label="Filtrar por etapa">
        {ABAS.map((a) => {
          const n = daAba(a).length;
          const ativa = a.chave === aba.chave;
          return (
            <Link
              key={a.chave}
              href={`/dia?de=${de}&ate=${ate}${a.chave !== "tudo" ? `&aba=${a.chave}` : ""}`}
              aria-current={ativa ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-[13.5px] font-medium transition-colors",
                ativa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {a.rotulo}
              <span className={cn("tabular rounded-full px-1.5 text-xs", ativa ? "bg-primary text-primary-foreground" : "bg-muted")}>{n}</span>
            </Link>
          );
        })}
      </nav>

      {pedidosDoDia.length > 0 && (
        <div className="mb-4">
          <EncaminharPedidos pedidos={pedidosDoDia} titulo={`Pedidos fechados · ${periodo}`} />
        </div>
      )}

      <Card className={cn(pedidosDoDia.length > 0 && lista.length === 0 && "hidden")}>
        <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-1 px-2 py-2">
          {lista.length === 0 && (
            <Vazio
              titulo={aba.chave === "tudo" ? "Nada registrado neste período" : `Nenhum item em “${aba.rotulo}” neste período`}
              descricao="Lançamentos aparecem aqui pela data do pedido, do orçamento, da emissão e da entrega."
            />
          )}
          {[...porDia].map(([data, itens]) => (
            <div key={data}>
              {!umDia && (
                <div className="px-3 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {formatarData(data)} · {diaSemana(data)}
                </div>
              )}
              {itens.map((a, i) => {
                const t = ICONES[a.tipo];
                return (
                  <Link key={i} href={a.link} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted">
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg [&_svg]:size-4", t.cor)}>
                      <t.icone />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={cn("truncate text-[13.5px] font-medium", a.alerta && "text-st-urgente")}>{a.titulo}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {a.obra} · {a.detalhe}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {a.valor != null && <div className="tabular text-[13px] font-medium">{formatarReais(a.valor)}</div>}
                      <div className="text-xs text-muted-foreground">{a.hora ?? t.rotulo}</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
