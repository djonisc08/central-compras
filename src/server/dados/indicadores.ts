// Indicadores de compras de um período. Usa as fórmulas de src/lib/kpis.ts.
// Mesmo código para o relatório mensal (skill), a página imprimível e o painel.
import { sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { diasEntre, fimDoMes, inicioDoMes, somarDias } from "@/lib/datas";
import {
  calcularCostAvoidance,
  calcularLeadTime,
  calcularSaving,
  curvaABC,
  entregueNoPrazo,
  media,
  META_URGENTES,
  percentualUrgentes,
  pontualidade,
  variacaoPreco,
} from "@/lib/kpis";

export type Periodo = { inicio: string; fim: string };

export function periodoDoMes(anoMes: string): Periodo {
  return { inicio: `${anoMes}-01`, fim: fimDoMes(`${anoMes}-01`) };
}

export function periodoAnterior(p: Periodo): Periodo {
  const dias = diasEntre(p.inicio, p.fim) + 1;
  // Mês fechado → mês anterior; período livre → mesma duração imediatamente antes.
  if (p.inicio.endsWith("-01") && p.fim === fimDoMes(p.inicio)) {
    const ant = inicioDoMes(somarDias(p.inicio, -1));
    return { inicio: ant, fim: fimDoMes(ant) };
  }
  return { inicio: somarDias(p.inicio, -dias), fim: somarDias(p.inicio, -1) };
}

type LinhaItem = {
  pedido_id: number;
  data_emissao: string;
  material_id: number;
  material: string;
  unidade: string;
  categoria: string;
  quantidade: number;
  preco: number; // preço cotado do item
  /** Valor exato da linha do pedido (como no orçamento). */
  total: number;
  desconto_bp: number;
  requisicao_item_id: number | null;
  obra: string;
  fornecedor: string;
  fornecedor_id: number;
};

/** Todos os itens de pedidos emitidos (base do histórico de preços). */
function itensEmitidos(db: DB, ate: string) {
  return db.all<LinhaItem>(sql`
    select pi.pedido_id, p.data_emissao, pi.material_id, m.nome_padronizado as material, m.unidade, c.nome as categoria,
           pi.quantidade, pi.preco_unitario_centavos as preco,
           coalesce(pi.total_centavos, round(pi.quantidade * pi.preco_unitario_centavos)) as total, p.desconto_bp, pi.requisicao_item_id,
           o.nome as obra, f.nome as fornecedor, f.id as fornecedor_id
    from pedido_itens pi
    join pedidos p on p.id = pi.pedido_id
    join materiais m on m.id = pi.material_id
    join categorias c on c.id = m.categoria_id
    join requisicoes r on r.id = p.requisicao_id
    join obras o on o.id = r.obra_id
    join fornecedores f on f.id = p.fornecedor_id
    where p.status not in ('cancelado', 'aguardando_aprovacao', 'aprovado') and p.data_emissao is not null and p.data_emissao <= ${ate}
    order by p.data_emissao, p.id, pi.id
  `);
}

const efetivo = (l: { preco: number; desconto_bp: number }) =>
  l.desconto_bp > 0 ? Math.round((l.preco * (10000 - l.desconto_bp)) / 10000) : l.preco;
/** Valor gasto na linha: total exato do pedido com o desconto à vista. */
const valorLinha = (l: { total: number; desconto_bp: number }) =>
  l.desconto_bp > 0 ? Math.round((l.total * (10000 - l.desconto_bp)) / 10000) : l.total;

export function calcularIndicadores(db: DB, periodo: Periodo) {
  const { inicio, fim } = periodo;
  const todos = itensEmitidos(db, fim);
  const doPeriodo = todos.filter((l) => l.data_emissao >= inicio);

  // ------------------------------------------------ saving (vs última compra)
  const ultimoPreco = new Map<number, number>();
  const savingItens: { material: string; obra: string; fornecedor: string; anterior: number; novo: number; quantidade: number; valor: number }[] = [];
  let semBase = 0;
  for (const l of todos) {
    const novo = efetivo(l);
    if (l.data_emissao >= inicio) {
      const s = calcularSaving(ultimoPreco.get(l.material_id), novo, l.quantidade);
      if (s == null) semBase += 1;
      else savingItens.push({ material: l.material, obra: l.obra, fornecedor: l.fornecedor, anterior: ultimoPreco.get(l.material_id)!, novo, quantidade: l.quantidade, valor: s });
    }
    ultimoPreco.set(l.material_id, novo);
  }
  const saving = savingItens.reduce((s, x) => s + x.valor, 0);

  // ------------------------------------------- cost avoidance (vs maior cotação)
  const reqItemIds = doPeriodo.map((l) => l.requisicao_item_id).filter((x): x is number => x != null);
  const cotacoes = new Map<number, number[]>();
  if (reqItemIds.length) {
    const linhas = db.all<{ requisicao_item_id: number; preco: number }>(sql`
      select requisicao_item_id, preco_unitario_centavos as preco from proposta_itens
      where disponivel = 1 and requisicao_item_id in (${sql.join(reqItemIds.map((i) => sql`${i}`), sql`, `)})
    `);
    for (const c of linhas) cotacoes.set(c.requisicao_item_id, [...(cotacoes.get(c.requisicao_item_id) ?? []), c.preco]);
  }
  const costAvoidance = doPeriodo.reduce(
    (s, l) => s + (l.requisicao_item_id ? calcularCostAvoidance(cotacoes.get(l.requisicao_item_id) ?? [], l.preco, l.quantidade) : 0),
    0,
  );

  // --------------------------------------------------------------- gastos
  const pedidosPeriodo = db.all<{
    id: number;
    numero: string;
    valor: number;
    frete: number;
    data_emissao: string;
    data_requisicao: string;
    urgente: number;
    obra: string;
    fornecedor: string;
    fornecedor_id: number;
  }>(sql`
    select p.id, p.numero, p.valor_total_centavos as valor, p.frete_centavos as frete, p.data_emissao, r.data_pedido as data_requisicao,
           r.urgente, o.nome as obra, f.nome as fornecedor, f.id as fornecedor_id
    from pedidos p join requisicoes r on r.id = p.requisicao_id join obras o on o.id = r.obra_id join fornecedores f on f.id = p.fornecedor_id
    where p.status not in ('cancelado', 'aguardando_aprovacao', 'aprovado') and p.data_emissao between ${inicio} and ${fim}
  `);
  const gasto = pedidosPeriodo.reduce((s, p) => s + p.valor, 0);
  const agrupar = <T,>(lista: T[], chave: (x: T) => string, valor: (x: T) => number) => {
    const m = new Map<string, number>();
    for (const x of lista) m.set(chave(x), (m.get(chave(x)) ?? 0) + valor(x));
    return [...m].map(([nome, total]) => ({ nome, total })).sort((a, b) => b.total - a.total);
  };
  const gastoPorObra = agrupar(pedidosPeriodo, (p) => p.obra, (p) => p.valor);
  const gastoPorFornecedor = agrupar(pedidosPeriodo, (p) => p.fornecedor, (p) => p.valor);
  const gastoPorCategoria = agrupar(doPeriodo, (l) => l.categoria, (l) => valorLinha(l));

  // --------------------------------------------------- prazos e urgência
  const leadTimes = pedidosPeriodo.map((p) => calcularLeadTime(p.data_requisicao, p.data_emissao));
  const reqs = db.get<{ total: number; urgentes: number }>(sql`
    select count(*) as total, coalesce(sum(urgente), 0) as urgentes from requisicoes
    where data_pedido between ${inicio} and ${fim} and status != 'cancelada'
  `)!;

  const entregues = db.all<{ fornecedor: string; fornecedor_id: number; prazo: string; real: string; nao_conformes: number }>(sql`
    select f.nome as fornecedor, f.id as fornecedor_id, p.prazo_prometido as prazo,
           (select max(e.data_real) from entregas e where e.pedido_id = p.id) as real,
           (select count(*) from entregas e where e.pedido_id = p.id and e.conforme = 0) as nao_conformes
    from pedidos p join fornecedores f on f.id = p.fornecedor_id
    where p.status = 'entregue' and p.prazo_prometido is not null
      and (select max(e.data_real) from entregas e where e.pedido_id = p.id) between ${inicio} and ${fim}
  `);
  const noPrazo = entregues.filter((e) => entregueNoPrazo(e.real, e.prazo)).length;

  // ------------------------------------------------ variação de preço
  const ant = periodoAnterior(periodo);
  const mediaPonderada = (ls: LinhaItem[]) => {
    const m = new Map<number, { material: string; unidade: string; soma: number; qtd: number }>();
    for (const l of ls) {
      const x = m.get(l.material_id) ?? { material: l.material, unidade: l.unidade, soma: 0, qtd: 0 };
      x.soma += efetivo(l) * l.quantidade;
      x.qtd += l.quantidade;
      m.set(l.material_id, x);
    }
    return m;
  };
  const atual = mediaPonderada(doPeriodo);
  const anterior = mediaPonderada(todos.filter((l) => l.data_emissao >= ant.inicio && l.data_emissao <= ant.fim));
  const variacoes = [...atual]
    .map(([id, a]) => {
      const b = anterior.get(id);
      const precoAtual = a.soma / a.qtd;
      const precoAnterior = b ? b.soma / b.qtd : null;
      return { materialId: id, material: a.material, unidade: a.unidade, precoAtual, precoAnterior, variacao: variacaoPreco(precoAnterior, precoAtual) };
    })
    .filter((v) => v.variacao != null)
    .sort((x, y) => (y.variacao ?? 0) - (x.variacao ?? 0));

  // ------------------------------------------------------------ curva ABC
  const abc = curvaABC(agrupar(doPeriodo, (l) => l.material, (l) => valorLinha(l)).map((g) => ({ material: g.nome, valor: g.total })));

  // --------------------------------------------------------- fornecedores
  const notas = db.all<{ fornecedor_id: number; nota: number }>(sql`
    select p.fornecedor_id, avg((a.preco + a.prazo + a.qualidade + a.atendimento) / 4.0) as nota
    from avaliacoes_fornecedor a join pedidos p on p.id = a.pedido_id
    where p.data_emissao between ${inicio} and ${fim} group by p.fornecedor_id
  `);
  const fornecedoresResumo = gastoPorFornecedor.map((g) => {
    const id = pedidosPeriodo.find((p) => p.fornecedor === g.nome)!.fornecedor_id;
    const ent = entregues.filter((e) => e.fornecedor_id === id);
    return {
      fornecedor: g.nome,
      gasto: g.total,
      pedidos: pedidosPeriodo.filter((p) => p.fornecedor_id === id).length,
      pontualidade: pontualidade(ent.filter((e) => entregueNoPrazo(e.real, e.prazo)).length, ent.length),
      nota: notas.find((n) => n.fornecedor_id === id)?.nota ?? null,
    };
  });

  const pctUrgentes = percentualUrgentes(reqs.urgentes, reqs.total);
  const pont = pontualidade(noPrazo, entregues.length);

  // --------------------------------------------------- destaques e alertas
  const destaques: string[] = [];
  const alertas: string[] = [];
  const reais = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (f: number) => `${(f * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (costAvoidance > 0) destaques.push(`Economia na cotação de ${reais(costAvoidance)} frente às maiores propostas recebidas.`);
  if (saving > 0) destaques.push(`Saving de ${reais(saving)} em relação ao último preço pago dos mesmos materiais.`);
  const melhorSaving = [...savingItens].sort((a, b) => b.valor - a.valor)[0];
  if (melhorSaving && melhorSaving.valor > 0)
    destaques.push(`Maior saving: ${melhorSaving.material} (${melhorSaving.fornecedor}) — ${reais(melhorSaving.valor)}.`);
  if (pont != null && pont >= 0.9) destaques.push(`Pontualidade dos fornecedores em ${pct(pont)}.`);
  if (saving < 0) alertas.push(`Saving negativo (${reais(saving)}): pagamos mais que na última compra. Ver materiais em alta.`);
  if (pctUrgentes != null && pctUrgentes > META_URGENTES)
    alertas.push(`Compras urgentes em ${pct(pctUrgentes)} (meta < ${pct(META_URGENTES)}): ${reqs.urgentes} de ${reqs.total} requisições. Antecipar o planejamento com as obras.`);
  for (const v of variacoes.filter((v) => (v.variacao ?? 0) >= 0.05).slice(0, 3))
    alertas.push(`${v.material} subiu ${pct(v.variacao!)} em relação ao período anterior.`);
  for (const f of fornecedoresResumo.filter((f) => f.pontualidade != null && f.pontualidade < 0.8 && f.pedidos >= 2))
    alertas.push(`${f.fornecedor} entregou no prazo só ${pct(f.pontualidade!)} das vezes.`);
  const naoConformes = entregues.reduce((s, e) => s + e.nao_conformes, 0);
  if (naoConformes) alertas.push(`${naoConformes} entrega(s) não conforme(s) no período.`);

  return {
    periodo,
    periodoAnterior: ant,
    gasto,
    qtdPedidos: pedidosPeriodo.length,
    saving,
    savingItens,
    itensSemBase: semBase,
    costAvoidance,
    leadTimeMedio: media(leadTimes),
    requisicoes: reqs.total,
    urgentes: reqs.urgentes,
    pctUrgentes,
    entregues: entregues.length,
    noPrazo,
    pontualidade: pont,
    naoConformes,
    gastoPorObra,
    gastoPorCategoria,
    gastoPorFornecedor,
    fornecedores: fornecedoresResumo,
    variacoes,
    abc,
    destaques,
    alertas,
    pedidos: pedidosPeriodo,
  };
}

export type Indicadores = ReturnType<typeof calcularIndicadores>;
