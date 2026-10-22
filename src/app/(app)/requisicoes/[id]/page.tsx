import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { CalendarIcon, ChevronLeftIcon, FileTextIcon, GridIcon, HardHatIcon, MapPinIcon, PencilIcon, PlusIcon, UserIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarCategorias } from "@/server/dados/cadastros";
import { acompanhamentoCotacao } from "@/server/dados/cotacao";
import { obterEmpresa } from "@/server/dados/empresa";
import { obterMapa, podeExcluirRequisicao, temPedidosAtivos, ultimosPrecosPagos } from "@/server/dados/requisicoes";
import { PageHeader } from "@/components/page-header";
import { StatusRequisicaoBadge, UrgenteBadge } from "@/components/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vazio } from "@/components/vazio";
import { diasEntre, formatarData, hojeISO, prazoRelativo } from "@/lib/datas";
import { formatarNumero, formatarReais } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { AcoesRequisicao } from "./acoes-requisicao";
import { listarAnexosPendentes } from "@/server/anexos";
import { AnexarOrcamento } from "./anexar-orcamento";
import { CancelarRequisicao } from "@/components/cancelar-requisicao";
import { PedirCotacao } from "./pedir-cotacao";
import { PropostaAcoes } from "./proposta-acoes";

export async function generateMetadata({ params }: PageProps<"/requisicoes/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Requisição #${id}` };
}

export default async function RequisicaoPage({ params }: PageProps<"/requisicoes/[id]">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const mapa = obterMapa(db, Number(id));
  if (!mapa) notFound();
  const { requisicao: r, resumo } = mapa;
  const hoje = hojeISO();
  const empresa = obterEmpresa(db);
  const ultimos = ultimosPrecosPagos(db, r.itens.map((i) => i.materialId));
  const editavel = ["aberta", "cotando", "aguardando_aprovacao"].includes(r.status);
  const itensEditaveis = editavel && !temPedidosAtivos(db, r.id);

  const nomesCategorias = new Map(listarCategorias(db).map((c) => [c.id, c.nome]));
  const itensCotacao = r.itens.map((i) => ({
    id: i.id,
    material: i.material,
    quantidade: i.quantidade,
    unidade: i.unidade,
    especificacao: i.especificacao,
    categoriaId: i.categoriaId,
    categoria: nomesCategorias.get(i.categoriaId) ?? "Sem categoria",
  }));
  const dadosMensagem = {
    requisicaoId: r.id,
    obra: r.obra,
    enderecoObra: r.enderecoObra,
    dataNecessidade: r.dataNecessidade,
    urgente: r.urgente,
    empresa: empresa.nomeFantasia ?? empresa.razaoSocial,
    comprador: empresa.comprador,
    faturamento: { razaoSocial: r.razaoSocialObra, cnpj: r.cnpjObra, cno: r.cnoObra, cep: r.cepObra },
  };

  const dNec = diasEntre(hoje, r.dataNecessidade);

  return (
    <>
      <PageHeader
        antes={
          <Link href="/requisicoes" className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Requisições
          </Link>
        }
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Requisição #{r.id}
            <StatusRequisicaoBadge status={r.status} />
            {r.urgente && <UrgenteBadge />}
          </span>
        }
        descricao={r.obra}
        acoes={
          <>
            {editavel && (
              <Button variant="outline" asChild>
                <Link href={`/requisicoes/${r.id}/proposta`}>
                  <PlusIcon /> Lançar proposta
                </Link>
              </Button>
            )}
            <Button asChild disabled={mapa.propostas.length === 0}>
              <Link href={`/requisicoes/${r.id}/mapa`}>
                <GridIcon /> Comparar e fechar
              </Link>
            </Button>
            {r.status !== "cancelada" && r.status !== "entregue" && (
              <CancelarRequisicao
                id={r.id}
                resumo={`${r.obra} · ${r.itens.map((i) => i.material).slice(0, 3).join(", ")}${r.itens.length > 3 ? "…" : ""}`}
                podeExcluir={podeExcluirRequisicao(db, r.id)}
                depois="/requisicoes"
              />
            )}
            <AcoesRequisicao id={r.id} status={r.status} urgente={r.urgente} dataNecessidade={r.dataNecessidade} />
          </>
        }
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          <Card>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-4">
              <Info icone={<UserIcon />} rotulo="Solicitante" valor={r.solicitante} />
              <Info icone={<CalendarIcon />} rotulo="Pedido em" valor={formatarData(r.dataPedido)} />
              <Info
                icone={<CalendarIcon />}
                rotulo="Precisa até"
                valor={
                  <span>
                    {formatarData(r.dataNecessidade)}{" "}
                    {editavel && (
                      <span className={cn("text-xs font-medium", dNec < 0 ? "text-st-urgente" : dNec <= 1 ? "text-st-atencao" : "text-muted-foreground")}>
                        ({prazoRelativo(r.dataNecessidade, hoje)})
                      </span>
                    )}
                  </span>
                }
              />
              <Info icone={<HardHatIcon />} rotulo="Engenheiro" valor={r.engenheiro ?? "—"} />
              {r.enderecoObra && (
                <Info className="col-span-2 sm:col-span-4" icone={<MapPinIcon />} rotulo="Entrega" valor={r.enderecoObra} />
              )}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Itens ({r.itens.length})</CardTitle>
              {itensEditaveis && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/requisicoes/${r.id}/editar`}>
                    <PencilIcon /> Editar / adicionar itens
                  </Link>
                </Button>
              )}
            </CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Último pago</TableHead>
                  <TableHead className="hidden text-right md:table-cell">Vencedor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumo.linhas.map((l) => {
                  const ult = ultimos.get(l.item.materialId);
                  const venc = mapa.propostas.find((p) => p.id === l.propostaEscolhidaId);
                  return (
                    <TableRow key={l.item.id}>
                      <TableCell>
                        <div className="font-medium">{l.item.material}</div>
                        {l.item.especificacao && <div className="text-xs text-muted-foreground">{l.item.especificacao}</div>}
                      </TableCell>
                      <TableCell className="tabular text-right whitespace-nowrap">
                        {formatarNumero(l.item.quantidade)} <span className="text-muted-foreground">{l.item.unidade}</span>
                      </TableCell>
                      <TableCell className="tabular hidden text-right sm:table-cell">
                        {ult ? (
                          <>
                            {formatarReais(ult.preco)}
                            <div className="text-[11px] text-muted-foreground">{formatarData(ult.data)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        {venc ? (
                          <>
                            <div className="text-[13px]">{venc.fornecedor}</div>
                            <div className="tabular text-xs text-muted-foreground">{formatarReais(l.precoEscolhido)}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {editavel && (
            <PedirCotacao requisicaoId={r.id} itens={itensCotacao} fornecedores={acompanhamentoCotacao(db, r.id)} dados={dadosMensagem} />
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Propostas recebidas ({mapa.propostas.length})</CardTitle>
                <CardDescription>Totais com frete. A comparação item a item está no mapa.</CardDescription>
              </div>
            </CardHeader>
            {mapa.propostas.length > 0 && itensEditaveis && (
              <div className="mx-5 mb-3 flex flex-col gap-3 rounded-xl border border-primary/30 bg-accent/40 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-[13px]">
                  <div className="font-medium">
                    {resumo.itensComVencedor} de {resumo.totalItens} itens com fornecedor escolhido
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Veja os orçamentos lado a lado, escolha quem leva cada item (pode dividir entre fornecedores) e gere os pedidos.
                  </div>
                </div>
                <Button asChild className="shrink-0">
                  <Link href={`/requisicoes/${r.id}/mapa`}>
                    <GridIcon /> Comparar e fechar
                  </Link>
                </Button>
              </div>
            )}
            <CardContent className="grid gap-3">
              {editavel && <AnexarOrcamento requisicaoId={r.id} pendentes={listarAnexosPendentes(r.id)} />}
              {resumo.colunas.length === 0 ? (
                <Vazio
                  icone={<FileTextIcon />}
                  titulo="Nenhuma proposta ainda"
                  descricao="Peça cotação aos fornecedores no quadro acima e lance as respostas aqui (ou anexe o PDF acima e peça ao Claude)."
                  acao={
                    editavel && (
                      <Button asChild size="sm">
                        <Link href={`/requisicoes/${r.id}/proposta`}>
                          <PlusIcon /> Lançar proposta
                        </Link>
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...resumo.colunas]
                    .sort((a, b) => a.total - b.total)
                    .map((c) => {
                      const vencida = c.proposta.validade && c.proposta.validade < hoje && editavel;
                      const melhor = resumo.melhorUnico?.propostaId === c.proposta.id;
                      return (
                        <div key={c.proposta.id} className={cn("rounded-lg border p-3.5", melhor && "border-st-ok/40 bg-st-ok-bg/40")}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium">{c.proposta.fornecedor}</div>
                              <div className="text-xs text-muted-foreground">
                                {c.itensCotados}/{resumo.totalItens} itens · cotado em {formatarData(c.proposta.dataCotacao)}
                              </div>
                            </div>
                            {editavel && <PropostaAcoes requisicaoId={r.id} propostaId={c.proposta.id} fornecedorId={c.proposta.fornecedorId} />}
                          </div>
                          <div className="tabular mt-2 text-lg font-semibold">{formatarReais(c.total)}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {melhor && <Badge tom="ok">Menor total completo</Badge>}
                            {c.itensVencidos > 0 && <Badge tom="roxo">Vence {c.itensVencidos} {c.itensVencidos === 1 ? "item" : "itens"}</Badge>}
                            {vencida && <Badge tom="urgente">Validade vencida</Badge>}
                          </div>
                          <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <dt className="text-muted-foreground">Frete</dt>
                              <dd className="tabular">{c.proposta.freteCentavos ? formatarReais(c.proposta.freteCentavos) : "CIF"}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Prazo</dt>
                              <dd>{c.proposta.prazoEntregaDias == null ? "—" : c.proposta.prazoEntregaDias === 0 ? "Mesmo dia" : `${c.proposta.prazoEntregaDias} dia(s)`}</dd>
                            </div>
                            <div>
                              <dt className="text-muted-foreground">Pagamento</dt>
                              <dd className="truncate">{c.proposta.condicaoPagamento ?? "—"}</dd>
                            </div>
                          </dl>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4">
          {r.origemTexto && (
            <Card>
              <CardHeader>
                <CardTitle>Mensagem original</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="rounded-lg bg-muted/60 p-3 text-[13px] leading-relaxed whitespace-pre-wrap">{r.origemTexto}</p>
              </CardContent>
            </Card>
          )}
          {r.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent className="text-[13px] whitespace-pre-wrap">{r.observacoes}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Info({ icone, rotulo, valor, className }: { icone: React.ReactNode; rotulo: string; valor: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="flex items-center gap-1.5 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase [&_svg]:size-3.5">
        {icone}
        {rotulo}
      </div>
      <div className="mt-1 text-[13.5px]">{valor}</div>
    </div>
  );
}
