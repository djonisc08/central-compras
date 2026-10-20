import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AlertTriangleIcon, CalendarIcon, ChevronLeftIcon, ClipboardListIcon, MapPinIcon, StarIcon, TruckIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { obterEmpresa } from "@/server/dados/empresa";
import { obterPedido } from "@/server/dados/pedidos";
import { PageHeader } from "@/components/page-header";
import { StatusPedidoBadge, UrgenteBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { diasEntre, formatarData, hojeISO } from "@/lib/datas";
import { formatarNumero, formatarPercentual, formatarReais, totalItem } from "@/lib/dinheiro";
import { mensagemPedido } from "@/lib/mensagens";
import { formatarCnpj, linkWhatsapp } from "@/lib/normalizar";
import { cn } from "@/lib/utils";
import { AcoesPedido } from "./acoes-pedido";

export async function generateMetadata({ params }: PageProps<"/pedidos/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Pedido ${id}` };
}

export default async function PedidoPage({ params }: PageProps<"/pedidos/[id]">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const p = obterPedido(db, Number(id));
  if (!p) notFound();
  const empresa = obterEmpresa(db);
  const hoje = hojeISO();
  const atraso = p.prazoPrometido && ["emitido", "entregue_parcial"].includes(p.status) ? diasEntre(p.prazoPrometido, hoje) : 0;
  const ultimaEntrega = p.entregas.at(-1)?.dataReal;
  const atrasoFinal = p.status === "entregue" && p.prazoPrometido && ultimaEntrega ? diasEntre(p.prazoPrometido, ultimaEntrega) : 0;

  const wa =
    p.numero && p.fornecedorWhatsapp
      ? linkWhatsapp(
          p.fornecedorWhatsapp,
          mensagemPedido({
            numero: p.numero,
            fornecedorContato: p.fornecedorContato,
            empresa: empresa.nomeFantasia ?? empresa.razaoSocial,
            comprador: empresa.comprador,
            obra: p.obra,
            endereco: p.obraEndereco,
            cep: p.obraCep,
            razaoSocial: p.obraRazaoSocial,
            cnpj: p.obraCnpj,
            cno: p.obraCno,
            prazoPrometido: p.prazoPrometido,
            condicao: p.condicaoPagamento,
            total: formatarReais(p.valorTotalCentavos),
            itens: p.itens,
          }),
        )
      : null;

  const subtotal = p.itens.reduce((s, i) => s + totalItem(i.quantidade, i.precoUnitarioCentavos), 0);

  return (
    <>
      <PageHeader
        antes={
          <Link href="/pedidos" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Pedidos
          </Link>
        }
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            {p.numero ?? `Pedido em rascunho #${p.id}`}
            <StatusPedidoBadge status={p.status} />
            {p.urgente && <UrgenteBadge />}
          </span>
        }
        descricao={`${p.fornecedor} · ${p.obra}`}
        acoes={
          <AcoesPedido
            pedido={{
              id: p.id,
              status: p.status,
              numero: p.numero,
              prazoEntregaDias: p.prazoEntregaDias,
              avaliado: !!p.avaliacao,
            }}
            hoje={hoje}
            whatsapp={wa}
          />
        }
      />

      {atraso > 0 && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg bg-st-urgente-bg px-4 py-3 text-[13px]">
          <AlertTriangleIcon className="size-4 text-st-urgente" />
          <span>
            Entrega <strong>{atraso} dia(s) atrasada</strong> (prometida para {formatarData(p.prazoPrometido)}). Cobre o fornecedor
            {p.fornecedorContato ? ` (${p.fornecedorContato})` : ""}.
          </span>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Itens</CardTitle>
              <Link href={`/requisicoes/${p.requisicaoId}/mapa`} className="text-xs text-primary hover:underline">
                Requisição #{p.requisicaoId} · mapa
              </Link>
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Unitário</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.itens.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>
                      <div className="font-medium">{i.material}</div>
                      {(i.marca || i.especificacao) && (
                        <div className="text-xs text-muted-foreground">{[i.marca, i.especificacao].filter(Boolean).join(" · ")}</div>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right whitespace-nowrap">
                      {formatarNumero(i.quantidade)} <span className="text-muted-foreground">{i.unidade}</span>
                    </TableCell>
                    <TableCell className="tabular text-right">{formatarReais(i.precoUnitarioCentavos)}</TableCell>
                    <TableCell className="tabular text-right font-medium">{formatarReais(totalItem(i.quantidade, i.precoUnitarioCentavos))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="text-right text-muted-foreground">
                    Itens
                  </TableCell>
                  <TableCell className="tabular text-right">{formatarReais(subtotal)}</TableCell>
                </TableRow>
                {p.descontoBp > 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={3} className="text-right text-st-ok">
                      Desconto à vista ({formatarPercentual(p.descontoBp / 10000)})
                    </TableCell>
                    <TableCell className="tabular text-right text-st-ok">−{formatarReais(subtotal - (p.valorTotalCentavos - p.freteCentavos))}</TableCell>
                  </TableRow>
                )}
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="text-right text-muted-foreground">
                    Frete
                  </TableCell>
                  <TableCell className="tabular text-right">{p.freteCentavos ? formatarReais(p.freteCentavos) : "CIF"}</TableCell>
                </TableRow>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="text-right font-semibold">
                    Total do pedido
                  </TableCell>
                  <TableCell className="tabular text-right text-[15px] font-semibold">{formatarReais(p.valorTotalCentavos)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Entregas</CardTitle>
              {p.status === "entregue" && (
                <Badge tom={atrasoFinal > 0 ? "urgente" : "ok"}>{atrasoFinal > 0 ? `Entregue com ${atrasoFinal}d de atraso` : "Entregue no prazo"}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {p.entregas.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  {p.status === "emitido" ? "Nenhuma entrega registrada ainda." : "A entrega é registrada depois que o pedido é emitido."}
                </p>
              ) : (
                <ol className="grid gap-2">
                  {p.entregas.map((e) => (
                    <li key={e.id} className="flex items-start gap-3 rounded-lg border px-3 py-2.5">
                      <TruckIcon className={cn("mt-0.5 size-4 shrink-0", e.conforme ? "text-st-ok" : "text-st-urgente")} />
                      <div className="min-w-0 flex-1 text-[13px]">
                        <div className="font-medium">
                          {formatarData(e.dataReal)} · {e.parcial ? "Entrega parcial" : "Entrega final"}
                        </div>
                        {e.observacao && <div className="text-muted-foreground">{e.observacao}</div>}
                      </div>
                      <Badge tom={e.conforme ? "ok" : "urgente"}>{e.conforme ? "Conforme" : "Não conforme"}</Badge>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          {p.avaliacao && (
            <Card>
              <CardHeader>
                <CardTitle>Avaliação do fornecedor</CardTitle>
                <span className="tabular text-[13px] font-semibold">
                  {((p.avaliacao.preco + p.avaliacao.prazo + p.avaliacao.qualidade + p.avaliacao.atendimento) / 4).toFixed(1).replace(".", ",")} / 5
                </span>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["Preço", p.avaliacao.preco],
                    ["Prazo", p.avaliacao.prazo],
                    ["Qualidade", p.avaliacao.qualidade],
                    ["Atendimento", p.avaliacao.atendimento],
                  ] as const
                ).map(([rot, n]) => (
                  <div key={rot}>
                    <div className="text-xs text-muted-foreground">{rot}</div>
                    <div className="mt-0.5 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((k) => (
                        <StarIcon key={k} className={cn("size-3.5", k <= n ? "fill-st-atencao text-st-atencao" : "text-muted-foreground/30")} />
                      ))}
                    </div>
                  </div>
                ))}
                {p.avaliacao.comentario && <p className="col-span-full text-[13px] text-muted-foreground">“{p.avaliacao.comentario}”</p>}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardContent className="grid gap-3.5 pt-5 text-[13px]">
              <Info icone={<CalendarIcon />} rotulo="Linha do tempo">
                <ul className="grid gap-1">
                  <Passo feito rotulo="Requisição" data={p.dataRequisicao} />
                  <Passo feito rotulo="Pedido gerado" data={p.criadoEm.slice(0, 10)} />
                  <Passo feito={!!p.dataAprovacao} rotulo={p.aprovadoPor ? `Aprovado por ${p.aprovadoPor}` : "Aprovação"} data={p.dataAprovacao} />
                  <Passo feito={!!p.dataEmissao} rotulo="Emitido" data={p.dataEmissao} />
                  <Passo feito={!!ultimaEntrega && p.status === "entregue"} rotulo="Entregue" data={p.status === "entregue" ? ultimaEntrega : null} />
                </ul>
              </Info>
              <Info icone={<TruckIcon />} rotulo="Prazo de entrega">
                {p.prazoPrometido ? (
                  <>
                    Prometido para <strong>{formatarData(p.prazoPrometido)}</strong>
                  </>
                ) : (
                  `${p.prazoEntregaDias ?? "—"} dia(s) após a emissão`
                )}
                <div className="text-xs text-muted-foreground">Obra precisa até {formatarData(p.dataNecessidade)}</div>
              </Info>
              <Info icone={<ClipboardListIcon />} rotulo="Pagamento">
                {p.condicaoPagamento ?? "—"}
                {p.formaPagamento === "avista" && p.descontoBp > 0 && (
                  <div className="text-xs text-st-ok">desconto à vista de {formatarPercentual(p.descontoBp / 10000)} aplicado</div>
                )}
              </Info>
              <Info icone={<MapPinIcon />} rotulo="Faturamento e entrega">
                <div className="font-medium">{p.obraRazaoSocial ?? empresa.razaoSocial}</div>
                {p.obraCnpj && <div className="tabular">CNPJ {formatarCnpj(p.obraCnpj)}</div>}
                {p.obraCno && <div className="tabular">CNO {p.obraCno}</div>}
                <div className="text-muted-foreground">
                  {p.obraEndereco}
                  {p.obraCep && ` · CEP ${p.obraCep}`}
                </div>
              </Info>
              <Info icone={<TruckIcon />} rotulo="Fornecedor">
                <div className="font-medium">{p.fornecedor}</div>
                {p.fornecedorCnpj && <div className="tabular">CNPJ {formatarCnpj(p.fornecedorCnpj)}</div>}
                <div className="text-muted-foreground">{[p.fornecedorContato, p.fornecedorEmail].filter(Boolean).join(" · ")}</div>
              </Info>
              {p.motivoCancelamento && (
                <Info icone={<AlertTriangleIcon />} rotulo="Motivo do cancelamento">
                  {p.motivoCancelamento}
                </Info>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Info({ icone, rotulo, children }: { icone: React.ReactNode; rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase [&_svg]:size-3.5">
        {icone}
        {rotulo}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Passo({ feito, rotulo, data }: { feito: boolean; rotulo: string; data: string | null | undefined }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", feito ? "bg-st-ok" : "border border-muted-foreground/40")} />
      <span className={cn("flex-1", !feito && "text-muted-foreground")}>{rotulo}</span>
      <span className="tabular text-xs text-muted-foreground">{data ? formatarData(data) : ""}</span>
    </li>
  );
}
