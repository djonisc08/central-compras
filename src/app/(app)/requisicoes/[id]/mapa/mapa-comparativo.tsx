"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { AlertTriangleIcon, AwardIcon, CheckIcon, EraserIcon, PiggyBankIcon, SparklesIcon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";
import { FormulaTip } from "@/components/formula-tip";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FORMULAS } from "@/lib/kpis";
import { formatarData } from "@/lib/datas";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/dinheiro";
import { atendePrazo, calcularMapa, previsaoEntrega, type ResumoMapa } from "@/lib/mapa";
import { cn } from "@/lib/utils";
import {
  limparVencedoresAction,
  marcarFornecedorVencedorAction,
  marcarMenoresPrecosAction,
  marcarVencedorItemAction,
} from "@/server/actions/requisicoes";

type Escolhas = Record<number, number | null>; // requisicaoItemId → propostaId

export function MapaComparativo({
  requisicaoId,
  editavel,
  hoje,
  dataNecessidade,
  resumo: resumoServidor,
  ultimos,
}: {
  requisicaoId: number;
  editavel: boolean;
  hoje: string;
  dataNecessidade: string;
  resumo: ResumoMapa;
  ultimos: Record<number, number>;
}) {
  const [pendente, iniciar] = useTransition();
  const escolhasServidor: Escolhas = Object.fromEntries(resumoServidor.linhas.map((l) => [l.item.id, l.propostaEscolhidaId]));
  const [escolhas, aplicarOtimista] = useOptimistic(escolhasServidor, (atual: Escolhas, novo: Escolhas) => ({ ...atual, ...novo }));

  // Recalcula localmente com as escolhas otimistas para a tela responder na hora.
  const propostas = resumoServidor.colunas.map((c) => ({
    ...c.proposta,
    itens: c.proposta.itens.map((i) => ({ ...i, vencedora: escolhas[i.requisicaoItemId] === c.proposta.id })),
  }));
  const resumo = calcularMapa(
    resumoServidor.linhas.map((l) => l.item),
    propostas,
  );

  function rodar(otimista: Escolhas, acao: () => Promise<{ ok: boolean; erro?: string }>) {
    iniciar(async () => {
      aplicarOtimista(otimista);
      const r = await acao();
      if (!r.ok) toast.error(r.erro ?? "Erro");
    });
  }

  function clicarCelula(itemId: number, propostaId: number) {
    if (!editavel) return;
    const novo = escolhas[itemId] === propostaId ? null : propostaId;
    rodar({ [itemId]: novo }, () => marcarVencedorItemAction(itemId, novo));
  }

  function vencerTudo(propostaId: number) {
    const otimista: Escolhas = {};
    for (const l of resumo.linhas) {
      const c = l.celulas.find((x) => x.propostaId === propostaId);
      if (c?.preco != null) otimista[l.item.id] = propostaId;
    }
    rodar(otimista, () => marcarFornecedorVencedorAction(requisicaoId, propostaId));
  }

  function menoresPrecos() {
    const otimista: Escolhas = {};
    for (const l of resumo.linhas) {
      const c = l.celulas.find((x) => x.totalLiquido === l.menorTotal && x.totalLiquido != null);
      otimista[l.item.id] = c?.propostaId ?? null;
    }
    rodar(otimista, () => marcarMenoresPrecosAction(requisicaoId));
  }

  function limpar() {
    rodar(Object.fromEntries(resumo.linhas.map((l) => [l.item.id, null])), () => limparVencedoresAction(requisicaoId));
  }

  const completas = resumo.colunas.filter((c) => c.completa);
  const menorTotalCompleto = completas.length ? Math.min(...completas.map((c) => c.total)) : null;
  const diferenca = resumo.melhorUnico && resumo.menorPorItem.completo ? resumo.melhorUnico.total - resumo.menorPorItem.total : null;
  const atende = (c: (typeof resumo.colunas)[number]) => atendePrazo(c.proposta.prazoEntregaDias, hoje, dataNecessidade);
  const melhorUnicoCol = resumo.colunas.find((c) => c.proposta.id === resumo.melhorUnico?.propostaId);
  const melhorUnicoAtrasa = melhorUnicoCol ? atende(melhorUnicoCol) === false : false;
  // Melhor opção completa que chega a tempo (considera o desconto à vista, se houver).
  const melhorNoPrazo = [...completas]
    .filter((c) => atende(c) !== false)
    .sort((a, b) => (a.totalAVista ?? a.total) - (b.totalAVista ?? b.total))[0];
  const semImpostos = resumo.colunas.some((c) => c.proposta.impostosInclusos === false);

  return (
    <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4 transition-opacity", pendente && "opacity-90")}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          rotulo="Total escolhido"
          icone={<CheckIcon />}
          tom={resumo.itensComVencedor === resumo.totalItens ? "ok" : "neutro"}
          valor={formatarReais(resumo.totalEscolhido)}
          detalhe={`${resumo.itensComVencedor} de ${resumo.totalItens} itens com vencedor · fretes incluídos`}
        />
        <KpiCard
          rotulo="Economia na cotação"
          icone={<PiggyBankIcon />}
          tom="ok"
          formula={FORMULAS.costAvoidance}
          valor={<span className="text-st-ok">{formatarReais(resumo.economiaTotal)}</span>}
          detalhe="Maior cotação − escolhida (cost avoidance)"
        />
        <KpiCard
          rotulo="Melhor fornecedor único"
          icone={<TrophyIcon />}
          tom="info"
          valor={resumo.melhorUnico ? formatarReais(resumo.melhorUnico.total) : "—"}
          detalhe={
            resumo.melhorUnico ? (
              <span className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {resumo.melhorUnico.fornecedor}
                  {melhorUnicoAtrasa && <span className="font-medium text-st-urgente"> · não chega a tempo</span>}
                </span>
                {editavel && (
                  <button type="button" className="shrink-0 cursor-pointer font-medium text-marca-verde-escuro hover:underline" onClick={() => vencerTudo(resumo.melhorUnico!.propostaId)}>
                    Escolher
                  </button>
                )}
              </span>
            ) : (
              "Nenhum fornecedor cotou todos os itens"
            )
          }
        />
        <KpiCard
          rotulo="Menor preço por item"
          icone={<SparklesIcon />}
          tom="atencao"
          valor={resumo.menorPorItem.total ? formatarReais(resumo.menorPorItem.total) : "—"}
          detalhe={
            <span className="flex items-center justify-between gap-2">
              <span className="truncate">
                {resumo.menorPorItem.fornecedores} fornec. com frete
                {diferenca != null && diferenca !== 0 && (
                  <span className={diferenca > 0 ? "text-st-ok" : "text-st-urgente"}>
                    {" "}
                    · {diferenca > 0 ? "−" : "+"}
                    {formatarReais(Math.abs(diferenca))}
                  </span>
                )}
              </span>
              {editavel && (
                <button type="button" className="shrink-0 cursor-pointer font-medium text-marca-verde-escuro hover:underline" onClick={menoresPrecos}>
                  Aplicar
                </button>
              )}
            </span>
          }
        />
      </div>

      {(melhorUnicoAtrasa || semImpostos) && (
        <div className="grid gap-2">
          {melhorUnicoAtrasa && (
            <Aviso tom="urgente">
              <strong>{resumo.melhorUnico!.fornecedor}</strong> tem o menor total, mas a previsão de entrega (
              {formatarData(previsaoEntrega(melhorUnicoCol!.proposta.prazoEntregaDias, hoje))}) passa da necessidade da obra (
              {formatarData(dataNecessidade)}).
              {melhorNoPrazo && (
                <>
                  {" "}
                  Melhor opção que chega a tempo: <strong>{melhorNoPrazo.proposta.fornecedor}</strong> —{" "}
                  {formatarReais(melhorNoPrazo.totalAVista ?? melhorNoPrazo.total)}
                  {melhorNoPrazo.totalAVista != null && " à vista"}.
                  {editavel && (
                    <button type="button" className="ml-1 cursor-pointer font-medium underline" onClick={() => vencerTudo(melhorNoPrazo.proposta.id)}>
                      Escolher
                    </button>
                  )}
                </>
              )}
            </Aviso>
          )}
          {semImpostos && (
            <Aviso tom="atencao">
              Há proposta com preço <strong>sem IPI/impostos</strong> ({resumo.colunas.filter((c) => c.proposta.impostosInclusos === false).map((c) => c.proposta.fornecedor).join(", ")}). Confirme o valor final antes de comparar.
            </Aviso>
          )}
        </div>
      )}

      <div className="min-w-0 rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
          <p className="text-[12.5px] text-muted-foreground">
            {editavel ? (
              <>
                Toque no preço para <strong className="font-medium text-foreground">marcar o vencedor</strong> do item. Verde = menor preço.
              </>
            ) : (
              "Cotação encerrada: vencedores travados."
            )}
          </p>
          {editavel && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={menoresPrecos} disabled={pendente}>
                <AwardIcon /> Marcar menores preços
              </Button>
              <Button size="sm" variant="ghost" onClick={limpar} disabled={pendente || resumo.itensComVencedor === 0}>
                <EraserIcon /> Limpar
              </Button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr className="text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="sticky left-0 z-10 min-w-48 border-b bg-card px-4 py-2.5 text-left">Item</th>
                <th className="hidden border-b px-3 py-2.5 text-right sm:table-cell">Últ. pago</th>
                {resumo.colunas.map((c) => (
                  <th key={c.proposta.id} className="min-w-36 border-b border-l px-3 py-2.5 text-right align-bottom normal-case">
                    <div className="truncate text-[12.5px] font-semibold tracking-normal text-foreground" title={c.proposta.fornecedor}>
                      {c.proposta.fornecedor}
                    </div>
                    <div className="truncate font-normal tracking-normal" title={[c.proposta.vendedor, c.proposta.numeroOrcamento].filter(Boolean).join(" · ")}>
                      {c.proposta.numeroOrcamento ? `Nº ${c.proposta.numeroOrcamento}` : `${c.itensCotados}/${resumo.totalItens} itens`}
                    </div>
                    {c.proposta.impostosInclusos === false && (
                      <span className="mt-0.5 inline-block rounded bg-st-atencao-bg px-1.5 text-[10.5px] font-medium tracking-normal text-st-atencao">s/ IPI</span>
                    )}
                  </th>
                ))}
                <th className="min-w-28 border-b border-l px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1">
                    Economia <FormulaTip formula={FORMULAS.costAvoidance} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {resumo.linhas.map((l) => {
                const ult = ultimos[l.item.materialId];
                return (
                  <tr key={l.item.id} className="group">
                    <td className="sticky left-0 z-10 border-b bg-card px-4 py-2 group-hover:bg-muted/40">
                      <div className="font-medium">{l.item.material}</div>
                      <div className="tabular text-xs text-muted-foreground">
                        {formatarNumero(l.item.quantidade)} {l.item.unidade}
                        {l.item.especificacao && <> · {l.item.especificacao}</>}
                      </div>
                    </td>
                    <td className="tabular hidden border-b px-3 py-2 text-right text-muted-foreground sm:table-cell">{ult ? formatarReais(ult) : "—"}</td>
                    {l.celulas.map((c) => {
                      const prop = resumo.colunas.find((x) => x.proposta.id === c.propostaId)!.proposta;
                      const indisponivel = prop.itens.some((i) => i.requisicaoItemId === l.item.id && !i.disponivel);
                      const variacao = c.preco != null && ult ? c.preco / ult - 1 : null;
                      return (
                        <td key={c.propostaId} className="border-b border-l p-1">
                          {c.preco == null ? (
                            <div className="px-2 py-1.5 text-right text-xs text-muted-foreground/70">{indisponivel ? "não tem" : "—"}</div>
                          ) : (
                            <button
                              type="button"
                              disabled={!editavel}
                              onClick={() => clicarCelula(l.item.id, c.propostaId)}
                              title={variacao != null ? `${variacao >= 0 ? "+" : ""}${(variacao * 100).toFixed(1)}% vs último pago` : undefined}
                              className={cn(
                                "relative flex w-full flex-col items-end rounded-md px-2 py-1.5 text-right transition-all",
                                editavel && "cursor-pointer hover:bg-muted",
                                c.ehMenor && "bg-menor text-menor-foreground hover:bg-menor",
                                c.vencedora && "ring-2 ring-primary ring-inset",
                              )}
                              aria-pressed={c.vencedora}
                            >
                              {c.vencedora && (
                                <span className="absolute top-1 left-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                  <CheckIcon className="size-2.5" strokeWidth={3.5} />
                                </span>
                              )}
                              <span className={cn("tabular font-semibold", c.ehMenor && "font-bold")}>{formatarReais(c.preco)}</span>
                              <span className={cn("tabular text-[11px]", c.ehMenor ? "text-menor-foreground/80" : "text-muted-foreground")}>
                                {formatarReais(c.total)}
                              </span>
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="tabular border-b border-l px-3 py-2 text-right">
                      {l.economia > 0 ? <span className="font-medium text-st-ok">{formatarReais(l.economia)}</span> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="text-[12.5px]">
              <RodapeLinha rotulo="Subtotal" colunas={resumo.colunas.map((c) => formatarReais(c.subtotal))} />
              {resumo.colunas.some((c) => c.descontoNegociado > 0) && (
                <RodapeLinha
                  rotulo="Desconto negociado"
                  colunas={resumo.colunas.map((c) => (c.descontoNegociado ? `−${formatarReais(c.descontoNegociado)}` : "—"))}
                />
              )}
              <RodapeLinha rotulo="Frete" colunas={resumo.colunas.map((c) => (c.proposta.freteCentavos ? formatarReais(c.proposta.freteCentavos) : "CIF"))} />
              <tr className="font-semibold">
                <td className="sticky left-0 z-10 border-b bg-muted px-4 py-2.5">Total com frete</td>
                <td className="hidden border-b bg-muted sm:table-cell" />
                {resumo.colunas.map((c) => (
                  <td
                    key={c.proposta.id}
                    className={cn(
                      "tabular border-b border-l bg-muted px-3 py-2.5 text-right text-[13.5px]",
                      c.completa && c.total === menorTotalCompleto && completas.length > 1 && "text-st-ok",
                    )}
                  >
                    {formatarReais(c.total)}
                    {!c.completa && <div className="text-[10.5px] font-normal text-st-atencao">incompleta</div>}
                  </td>
                ))}
                <td className="tabular border-b border-l bg-muted px-3 py-2.5 text-right text-st-ok">{formatarReais(resumo.economiaTotal)}</td>
              </tr>
              {resumo.colunas.some((c) => c.totalAVista != null) && (
                <RodapeLinha
                  rotulo="À vista / antecipado"
                  colunas={resumo.colunas.map((c) =>
                    c.totalAVista != null ? (
                      <span key={c.proposta.id}>
                        <span className="font-medium">{formatarReais(c.totalAVista)}</span>
                        <span className="block text-[11px] text-muted-foreground">−{formatarPercentual((c.proposta.descontoAVistaBp ?? 0) / 10000)}</span>
                      </span>
                    ) : (
                      <span key={c.proposta.id} className="text-muted-foreground">sem desconto</span>
                    ),
                  )}
                />
              )}
              <RodapeLinha
                rotulo="Prazo de entrega"
                colunas={resumo.colunas.map((c) => (
                  <span key={c.proposta.id}>
                    {c.proposta.prazoEntregaDias == null ? "—" : c.proposta.prazoEntregaDias === 0 ? "Mesmo dia" : `${c.proposta.prazoEntregaDias} dia(s)`}
                    {c.proposta.prazoObservacao && <span className="block text-[11px] text-muted-foreground">{c.proposta.prazoObservacao}</span>}
                  </span>
                ))}
              />
              {editavel && (
                <RodapeLinha
                  rotulo={`Chega até ${formatarData(dataNecessidade).slice(0, 5)}?`}
                  colunas={resumo.colunas.map((c) => {
                    const ok = atende(c);
                    const prev = previsaoEntrega(c.proposta.prazoEntregaDias, hoje);
                    return ok == null ? (
                      <span key={c.proposta.id} className="text-muted-foreground">prazo não informado</span>
                    ) : (
                      <span key={c.proposta.id} className={cn("font-medium", ok ? "text-st-ok" : "text-st-urgente")}>
                        {ok ? "Atende" : "Não atende"}
                        <span className="block text-[11px] font-normal text-muted-foreground">~{formatarData(prev)}</span>
                      </span>
                    );
                  })}
                />
              )}
              <RodapeLinha rotulo="Pagamento" colunas={resumo.colunas.map((c) => c.proposta.condicaoPagamento ?? "—")} />
              <RodapeLinha
                rotulo="Validade"
                colunas={resumo.colunas.map((c) =>
                  c.proposta.validade ? (
                    <span key={c.proposta.id} className={cn(editavel && c.proposta.validade < hoje && "font-medium text-st-urgente")}>
                      {formatarData(c.proposta.validade)}
                      {editavel && c.proposta.validade < hoje && " · vencida"}
                    </span>
                  ) : (
                    "—"
                  ),
                )}
              />
              <RodapeLinha
                rotulo="Vencedor em"
                colunas={resumo.colunas.map((c) =>
                  c.itensVencidos ? (
                    <span key={c.proposta.id} className="font-medium text-marca-verde-escuro">
                      {c.itensVencidos} {c.itensVencidos === 1 ? "item" : "itens"} · {formatarReais(c.valorVencido + c.proposta.freteCentavos)}
                    </span>
                  ) : (
                    "—"
                  ),
                )}
              />
              {editavel && (
                <tr>
                  <td className="sticky left-0 z-10 bg-card px-4 py-2" />
                  <td className="hidden sm:table-cell" />
                  {resumo.colunas.map((c) => (
                    <td key={c.proposta.id} className="border-l px-2 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="xs" variant="outline" onClick={() => vencerTudo(c.proposta.id)} disabled={pendente}>
                              Fechar com este
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Escolhe este fornecedor em todos os itens que ele cotou (os outros itens você escolhe tocando no preço)</TooltipContent>
                        </Tooltip>
                        <Button size="xs" variant="ghost" asChild>
                          <Link href={`/requisicoes/${requisicaoId}/proposta?fornecedor=${c.proposta.fornecedorId}`}>Editar</Link>
                        </Button>
                      </div>
                    </td>
                  ))}
                  <td className="border-l" />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function Aviso({ tom, children }: { tom: "urgente" | "atencao"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-4 py-3 text-[13px] leading-relaxed",
        tom === "urgente" ? "bg-st-urgente-bg text-foreground" : "bg-st-atencao-bg text-foreground",
      )}
    >
      <AlertTriangleIcon className={cn("mt-0.5 size-4 shrink-0", tom === "urgente" ? "text-st-urgente" : "text-st-atencao")} />
      <p>{children}</p>
    </div>
  );
}

function RodapeLinha({ rotulo, colunas }: { rotulo: string; colunas: React.ReactNode[] }) {
  return (
    <tr>
      <td className="sticky left-0 z-10 border-b bg-card px-4 py-2 text-muted-foreground">{rotulo}</td>
      <td className="hidden border-b sm:table-cell" />
      {colunas.map((c, i) => (
        <td key={i} className="tabular border-b border-l px-3 py-2 text-right">
          {c}
        </td>
      ))}
      <td className="border-b border-l" />
    </tr>
  );
}
