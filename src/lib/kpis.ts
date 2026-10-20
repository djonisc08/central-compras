// Fórmulas dos indicadores. Funções puras: o mesmo código alimenta telas,
// relatórios e scripts. Os textos em FORMULAS aparecem nos tooltips.

import { diasEntre } from "./datas";
import { totalItem } from "./dinheiro";

export const FORMULAS = {
  saving:
    "Saving = (preço anterior pago − preço novo) × quantidade. Preço anterior = última compra do mesmo material (qualquer obra) antes deste pedido. Itens sem compra anterior não entram.",
  costAvoidance:
    "Cost avoidance = (maior cotação − cotação fechada) × quantidade. Só conta itens com 2 ou mais cotações.",
  leadTime:
    "Lead time = data de emissão do pedido − data da requisição (dias corridos). Média dos pedidos do período.",
  urgentes: "% urgentes = requisições marcadas como urgentes ÷ total de requisições do período. Meta: abaixo de 5%.",
  pontualidade:
    "Pontualidade = pedidos entregues até o prazo prometido ÷ pedidos entregues. Vale a data da última entrega.",
  variacao:
    "Variação = preço médio do mês ÷ preço médio do mês anterior − 1. Média ponderada pela quantidade comprada.",
  abc: "Curva ABC: materiais ordenados por gasto. A = até 80% do gasto acumulado, B = até 95%, C = restante.",
  gasto: "Gasto = soma dos pedidos emitidos no período (itens + frete). Pedidos cancelados não entram.",
} as const;

export const META_URGENTES = 0.05;

/** Saving em centavos. Retorna null quando não há preço anterior (sem base). */
export function calcularSaving(
  precoAnteriorCentavos: number | null | undefined,
  precoNovoCentavos: number,
  quantidade: number,
): number | null {
  if (precoAnteriorCentavos == null) return null;
  return totalItem(quantidade, precoAnteriorCentavos) - totalItem(quantidade, precoNovoCentavos);
}

/** Cost avoidance em centavos. Zero quando só existe uma cotação. */
export function calcularCostAvoidance(
  precosCotados: number[],
  precoFechadoCentavos: number,
  quantidade: number,
): number {
  if (precosCotados.length < 2) return 0;
  const maior = Math.max(...precosCotados);
  return totalItem(quantidade, maior) - totalItem(quantidade, precoFechadoCentavos);
}

export function calcularLeadTime(dataRequisicao: string, dataEmissaoPedido: string): number {
  return Math.max(0, diasEntre(dataRequisicao, dataEmissaoPedido));
}

export function media(valores: number[]): number | null {
  if (!valores.length) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function percentualUrgentes(urgentes: number, total: number): number | null {
  return total > 0 ? urgentes / total : null;
}

export function entregueNoPrazo(dataReal: string, prazoPrometido: string): boolean {
  return dataReal <= prazoPrometido;
}

export function pontualidade(noPrazo: number, entregues: number): number | null {
  return entregues > 0 ? noPrazo / entregues : null;
}

/** Variação relativa entre dois preços médios (fração; 0,05 = +5%). */
export function variacaoPreco(anterior: number | null, atual: number | null): number | null {
  if (anterior == null || atual == null || anterior === 0) return null;
  return atual / anterior - 1;
}

export type ClasseABC = "A" | "B" | "C";

export function curvaABC<T extends { valor: number }>(
  itens: T[],
): (T & { participacao: number; acumulado: number; classe: ClasseABC })[] {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  if (total <= 0) return [];
  let acumulado = 0;
  return [...itens]
    .sort((a, b) => b.valor - a.valor)
    .map((i) => {
      const anterior = acumulado;
      acumulado += i.valor / total;
      // A classe considera onde o item começa, para que o primeiro item sempre seja A.
      const classe: ClasseABC = anterior < 0.8 ? "A" : anterior < 0.95 ? "B" : "C";
      return { ...i, participacao: i.valor / total, acumulado, classe };
    });
}
