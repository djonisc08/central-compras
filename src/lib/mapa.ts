// Cálculo do mapa comparativo (itens × fornecedores). Funções puras, sem banco.

import { somarDias } from "./datas";
import { totalItem } from "./dinheiro";

/**
 * Previsão de chegada: prazo informado contado a partir de hoje (o pedido ainda vai ser
 * emitido). Prazos de fornecedor costumam valer "após faturamento/liberação", então é estimativa.
 */
export function previsaoEntrega(prazoDias: number | null | undefined, hoje: string): string | null {
  if (prazoDias == null) return null;
  return somarDias(hoje, prazoDias);
}

/** true = chega até a data de necessidade; null = prazo não informado. */
export function atendePrazo(prazoDias: number | null | undefined, hoje: string, dataNecessidade: string): boolean | null {
  const p = previsaoEntrega(prazoDias, hoje);
  return p == null ? null : p <= dataNecessidade;
}

export type MapaItemEntrada = {
  id: number;
  materialId: number;
  material: string;
  unidade: string;
  quantidade: number;
  especificacao: string | null;
};

export type MapaPropostaEntrada = {
  id: number;
  fornecedorId: number;
  fornecedor: string;
  freteCentavos: number;
  condicaoPagamento: string | null;
  /** Desconto à vista em centésimos de % (430 = 4,30%). */
  descontoAVistaBp?: number;
  prazoEntregaDias: number | null;
  prazoObservacao?: string | null;
  impostosInclusos?: boolean;
  numeroOrcamento?: string | null;
  vendedor?: string | null;
  validade: string | null;
  dataCotacao: string;
  itens: {
    requisicaoItemId: number;
    precoUnitarioCentavos: number;
    /** Valor exato da linha como está no orçamento (centavos). Quando existe, manda sobre preço × quantidade. */
    totalCentavos?: number | null;
    disponivel: boolean;
    vencedora: boolean;
    marca: string | null;
  }[];
};

export type Celula = {
  propostaId: number;
  preco: number | null; // null = não cotou / indisponível
  total: number | null;
  marca: string | null;
  ehMenor: boolean;
  ehMaior: boolean;
  vencedora: boolean;
};

export type LinhaMapa = {
  item: MapaItemEntrada;
  celulas: Celula[];
  menorPreco: number | null;
  maiorPreco: number | null;
  /** Menor e maior valor da linha (quantidade da requisição), base da comparação. */
  menorTotal: number | null;
  maiorTotal: number | null;
  qtdCotacoes: number;
  precoEscolhido: number | null;
  /** Valor exato da linha do fornecedor escolhido. */
  totalEscolhido: number | null;
  propostaEscolhidaId: number | null;
  /** Cost avoidance do item: (maior − escolhida) × quantidade. */
  economia: number;
};

export type ColunaMapa = {
  proposta: MapaPropostaEntrada;
  subtotal: number;
  total: number; // subtotal + frete
  /** Total com o desconto à vista aplicado aos itens (frete sem desconto); null se não há desconto. */
  totalAVista: number | null;
  itensCotados: number;
  completa: boolean;
  itensVencidos: number;
  valorVencido: number;
};

export type ResumoMapa = {
  linhas: LinhaMapa[];
  colunas: ColunaMapa[];
  totalItens: number;
  itensComVencedor: number;
  /** Total dos itens escolhidos + frete dos fornecedores com algum item vencido. */
  totalEscolhido: number;
  economiaTotal: number;
  /** Fornecedor que cotou tudo com o menor total (com frete). */
  melhorUnico: { propostaId: number; fornecedor: string; total: number } | null;
  /** Comprar cada item pelo menor preço (fretes dos fornecedores envolvidos somados). */
  menorPorItem: { total: number; fornecedores: number; completo: boolean };
};

export function calcularMapa(
  itens: MapaItemEntrada[],
  propostas: MapaPropostaEntrada[],
): ResumoMapa {
  const precoDe = (p: MapaPropostaEntrada, itemId: number) => {
    const pi = p.itens.find((x) => x.requisicaoItemId === itemId);
    if (!pi || !pi.disponivel) return null;
    return pi;
  };

  const linhas: LinhaMapa[] = itens.map((item) => {
    const totalDe = (pi: MapaPropostaEntrada["itens"][number]) => pi.totalCentavos ?? totalItem(item.quantidade, pi.precoUnitarioCentavos);
    const cotadas = propostas.map((p) => precoDe(p, item.id)).filter((x) => x != null);
    const precos = cotadas.map((pi) => pi.precoUnitarioCentavos);
    const totais = cotadas.map(totalDe);
    const menor = totais.length ? Math.min(...totais) : null;
    const maior = totais.length ? Math.max(...totais) : null;

    let precoEscolhido: number | null = null;
    let totalEscolhido: number | null = null;
    let propostaEscolhidaId: number | null = null;

    const celulas: Celula[] = propostas.map((p) => {
      const pi = precoDe(p, item.id);
      const preco = pi?.precoUnitarioCentavos ?? null;
      const total = pi ? totalDe(pi) : null;
      const vencedora = !!pi?.vencedora;
      if (vencedora && preco != null) {
        precoEscolhido = preco;
        totalEscolhido = total;
        propostaEscolhidaId = p.id;
      }
      return {
        propostaId: p.id,
        preco,
        total,
        marca: pi?.marca ?? null,
        ehMenor: total != null && total === menor && totais.length > 1,
        ehMaior: total != null && total === maior && totais.length > 1 && maior !== menor,
        vencedora,
      };
    });

    const economia = totalEscolhido != null && maior != null && totais.length > 1 ? maior - totalEscolhido : 0;

    return {
      item,
      celulas,
      menorPreco: precos.length ? Math.min(...precos) : null,
      maiorPreco: precos.length ? Math.max(...precos) : null,
      menorTotal: menor,
      maiorTotal: maior,
      qtdCotacoes: totais.length,
      precoEscolhido,
      totalEscolhido,
      propostaEscolhidaId,
      economia,
    };
  });

  const colunas: ColunaMapa[] = propostas.map((p, idx) => {
    let subtotal = 0;
    let itensCotados = 0;
    let itensVencidos = 0;
    let valorVencido = 0;
    for (const l of linhas) {
      const c = l.celulas[idx];
      if (c.total != null) {
        subtotal += c.total;
        itensCotados += 1;
      }
      if (c.vencedora && c.total != null) {
        itensVencidos += 1;
        valorVencido += c.total;
      }
    }
    const desconto = p.descontoAVistaBp ?? 0;
    return {
      proposta: p,
      subtotal,
      total: subtotal + p.freteCentavos,
      totalAVista: desconto > 0 ? Math.round((subtotal * (10000 - desconto)) / 10000) + p.freteCentavos : null,
      itensCotados,
      completa: itensCotados === itens.length && itens.length > 0,
      itensVencidos,
      valorVencido,
    };
  });

  const totalEscolhido = colunas.reduce(
    (s, c) => s + (c.itensVencidos > 0 ? c.valorVencido + c.proposta.freteCentavos : 0),
    0,
  );

  const completas = colunas.filter((c) => c.completa).sort((a, b) => a.total - b.total);
  const melhorUnico = completas[0]
    ? {
        propostaId: completas[0].proposta.id,
        fornecedor: completas[0].proposta.fornecedor,
        total: completas[0].total,
      }
    : null;

  const envolvidas = new Set<number>();
  let somaMenores = 0;
  let completo = true;
  for (const l of linhas) {
    if (l.menorTotal == null) {
      completo = false;
      continue;
    }
    // Em empate, prefere o fornecedor já envolvido para não somar outro frete.
    const candidatas = l.celulas.filter((c) => c.total === l.menorTotal);
    const escolhida =
      candidatas.find((c) => envolvidas.has(c.propostaId)) ??
      candidatas.sort(
        (a, b) =>
          (propostas.find((p) => p.id === a.propostaId)?.freteCentavos ?? 0) -
          (propostas.find((p) => p.id === b.propostaId)?.freteCentavos ?? 0),
      )[0];
    envolvidas.add(escolhida.propostaId);
    somaMenores += escolhida.total ?? 0;
  }
  const fretes = propostas
    .filter((p) => envolvidas.has(p.id))
    .reduce((s, p) => s + p.freteCentavos, 0);

  return {
    linhas,
    colunas,
    totalItens: itens.length,
    itensComVencedor: linhas.filter((l) => l.propostaEscolhidaId != null).length,
    totalEscolhido,
    economiaTotal: linhas.reduce((s, l) => s + l.economia, 0),
    melhorUnico,
    menorPorItem: { total: somaMenores + fretes, fornecedores: envolvidas.size, completo },
  };
}

/**
 * Recomendação em texto para o mapa impresso. Prioriza quem chega a tempo e,
 * entre esses, o menor valor considerando o desconto à vista.
 */
export function textoSugestao(resumo: ResumoMapa, hoje: string, dataNecessidade: string): string {
  const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const vencedores = resumo.colunas.filter((c) => c.itensVencidos > 0);
  if (resumo.itensComVencedor === resumo.totalItens && vencedores.length) {
    const partes = vencedores.map(
      (c) => `${c.proposta.fornecedor} (${c.itensVencidos} ${c.itensVencidos === 1 ? "item" : "itens"}, ${reais(c.valorVencido + c.proposta.freteCentavos)})`,
    );
    return `Fechar com ${partes.join(" + ")}. Total ${reais(resumo.totalEscolhido)}, economia de ${reais(resumo.economiaTotal)} sobre a maior cotação.`;
  }
  const completas = resumo.colunas.filter((c) => c.completa);
  if (!completas.length) return "Nenhum fornecedor cotou todos os itens: definir o vencedor de cada item no mapa.";
  const valor = (c: ColunaMapa) => c.totalAVista ?? c.total;
  const noPrazo = completas.filter((c) => atendePrazo(c.proposta.prazoEntregaDias, hoje, dataNecessidade) !== false).sort((a, b) => valor(a) - valor(b));
  const maisBarato = [...completas].sort((a, b) => valor(a) - valor(b))[0];
  const melhor = noPrazo[0];
  if (!melhor) return `Nenhuma proposta completa garante a entrega até ${dataNecessidade.split("-").reverse().join("/")}. Negociar prazo antes de fechar.`;
  const forma = melhor.totalAVista != null ? `à vista por ${reais(melhor.totalAVista)} (ou ${melhor.proposta.condicaoPagamento ?? "a prazo"} por ${reais(melhor.total)})` : `por ${reais(melhor.total)}${melhor.proposta.condicaoPagamento ? ` (${melhor.proposta.condicaoPagamento})` : ""}`;
  let texto = `Fechar com ${melhor.proposta.fornecedor} — ${forma}.`;
  if (maisBarato.proposta.id !== melhor.proposta.id)
    texto += ` ${maisBarato.proposta.fornecedor} é mais barata (${reais(valor(maisBarato))}), mas não chega a tempo.`;
  return texto;
}
