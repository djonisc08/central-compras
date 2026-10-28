import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import { nomeFornecedorSql } from "./cadastros";
import {
  fornecedores,
  materiais,
  obras,
  pedidoItens,
  pedidos,
  propostaItens,
  propostas,
  requisicaoItens,
  requisicoes,
  type StatusRequisicao,
} from "@/db/schema";
import { formatarReais } from "@/lib/dinheiro";
import { calcularMapa, type MapaItemEntrada, type MapaPropostaEntrada } from "@/lib/mapa";
import {
  conferirTotalProposta,
  propostaSchema,
  requisicaoSchema,
  type PropostaInput,
  type RequisicaoInput,
} from "@/lib/validacao";

export type FiltroRequisicoes = {
  obraId?: number;
  status?: StatusRequisicao | "em_andamento";
  urgente?: boolean;
  busca?: string;
};

const EM_ANDAMENTO: StatusRequisicao[] = ["aberta", "cotando", "aguardando_aprovacao", "aprovada"];

export function listarRequisicoes(db: DB, filtro: FiltroRequisicoes = {}) {
  const cond: SQL[] = [];
  if (filtro.obraId) cond.push(eq(requisicoes.obraId, filtro.obraId));
  if (filtro.status === "em_andamento") cond.push(inArray(requisicoes.status, EM_ANDAMENTO));
  else if (filtro.status) cond.push(eq(requisicoes.status, filtro.status));
  if (filtro.urgente) cond.push(eq(requisicoes.urgente, true));
  if (filtro.busca) {
    const b = `%${filtro.busca.toLowerCase()}%`;
    cond.push(
      sql`(lower(${requisicoes.solicitante}) like ${b} or cast(requisicoes.id as text) like ${b} or exists (select 1 from requisicao_itens ri join materiais m on m.id = ri.material_id where ri.requisicao_id = requisicoes.id and lower(m.nome_padronizado) like ${b}))`,
    );
  }

  return db
    .select({
      id: requisicoes.id,
      obraId: requisicoes.obraId,
      obra: obras.nome,
      solicitante: requisicoes.solicitante,
      dataPedido: requisicoes.dataPedido,
      dataNecessidade: requisicoes.dataNecessidade,
      urgente: requisicoes.urgente,
      status: requisicoes.status,
      qtdItens: sql<number>`(select count(*) from requisicao_itens ri where ri.requisicao_id = requisicoes.id)`,
      qtdPropostas: sql<number>`(select count(*) from propostas p where p.requisicao_id = requisicoes.id)`,
      resumoItens: sql<string>`(select group_concat(m.nome_padronizado, ' · ') from (select m.nome_padronizado from requisicao_itens ri join materiais m on m.id = ri.material_id where ri.requisicao_id = requisicoes.id order by ri.id limit 3) m)`,
    })
    .from(requisicoes)
    .innerJoin(obras, eq(obras.id, requisicoes.obraId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(
      sql`case when ${requisicoes.status} in ('entregue','cancelada','pedido_emitido') then 1 else 0 end`,
      desc(requisicoes.urgente),
      asc(requisicoes.dataNecessidade),
      desc(requisicoes.id),
    )
    .all();
}

export type RequisicaoLista = ReturnType<typeof listarRequisicoes>[number];

export function obterRequisicao(db: DB, id: number) {
  const req = db
    .select({
      id: requisicoes.id,
      obraId: requisicoes.obraId,
      obra: obras.nome,
      engenheiro: obras.engenheiroResponsavel,
      enderecoObra: obras.endereco,
      cepObra: obras.cep,
      razaoSocialObra: obras.razaoSocial,
      cnpjObra: obras.cnpj,
      cnoObra: obras.cno,
      solicitante: requisicoes.solicitante,
      dataPedido: requisicoes.dataPedido,
      dataNecessidade: requisicoes.dataNecessidade,
      urgente: requisicoes.urgente,
      status: requisicoes.status,
      origemTexto: requisicoes.origemTexto,
      observacoes: requisicoes.observacoes,
    })
    .from(requisicoes)
    .innerJoin(obras, eq(obras.id, requisicoes.obraId))
    .where(eq(requisicoes.id, id))
    .get();
  if (!req) return null;

  const itens = db
    .select({
      id: requisicaoItens.id,
      materialId: requisicaoItens.materialId,
      material: materiais.nomePadronizado,
      unidade: materiais.unidade,
      categoriaId: materiais.categoriaId,
      quantidade: requisicaoItens.quantidade,
      especificacao: requisicaoItens.especificacao,
    })
    .from(requisicaoItens)
    .innerJoin(materiais, eq(materiais.id, requisicaoItens.materialId))
    .where(eq(requisicaoItens.requisicaoId, id))
    .orderBy(asc(requisicaoItens.id))
    .all();

  return { ...req, itens };
}

export type RequisicaoDetalhe = NonNullable<ReturnType<typeof obterRequisicao>>;

export function criarRequisicao(db: DB, entrada: RequisicaoInput) {
  const dados = requisicaoSchema.parse(entrada);
  return db.transaction((tx) => {
    const { itens, ...cab } = dados;
    const id = tx
      .insert(requisicoes)
      .values({ ...cab, status: "aberta" })
      .returning({ id: requisicoes.id })
      .get().id;
    tx.insert(requisicaoItens)
      .values(itens.map((i) => ({ ...i, requisicaoId: id })))
      .run();
    return id;
  });
}

export function atualizarCabecalhoRequisicao(
  db: DB,
  id: number,
  dados: Partial<{ dataNecessidade: string; urgente: boolean; solicitante: string; observacoes: string | null }>,
) {
  db.update(requisicoes).set(dados).where(eq(requisicoes.id, id)).run();
}

/**
 * Cancela a cotação (a obra desistiu / não fechou). Pedidos ainda não enviados ao fornecedor
 * (aguardando aprovação ou aprovado) são cancelados junto; pedido já emitido precisa ser cancelado antes.
 */
export function cancelarRequisicao(db: DB, id: number, motivo = "") {
  const req = db.select().from(requisicoes).where(eq(requisicoes.id, id)).get();
  if (!req) throw new Error("Requisição não encontrada");
  const ativos = db
    .select({ id: pedidos.id, numero: pedidos.numero, status: pedidos.status })
    .from(pedidos)
    .where(and(eq(pedidos.requisicaoId, id), sql`${pedidos.status} != 'cancelado'`))
    .all();
  const enviados = ativos.filter((p) => !["aguardando_aprovacao", "aprovado"].includes(p.status));
  if (enviados.length)
    throw new Error(
      `O pedido ${enviados.map((p) => p.numero ?? `#${p.id}`).join(", ")} já foi emitido ao fornecedor. Cancele-o na tela do pedido (avisando o fornecedor) e depois cancele a cotação.`,
    );
  const texto = motivo.trim() || "sem motivo informado";
  const hoje = new Date().toLocaleDateString("pt-BR");
  db.transaction((tx) => {
    if (ativos.length)
      tx.update(pedidos)
        .set({ status: "cancelado", motivoCancelamento: `Cotação cancelada: ${texto}` })
        .where(inArray(pedidos.id, ativos.map((p) => p.id)))
        .run();
    tx.update(requisicoes)
      .set({ status: "cancelada", observacoes: [req.observacoes, `CANCELADA em ${hoje}: ${texto}`].filter(Boolean).join("\n") })
      .where(eq(requisicoes.id, id))
      .run();
  });
  return { pedidosCancelados: ativos.length };
}

/** Pode excluir de vez: nunca virou pedido (lançada por engano ou duplicada). */
export function podeExcluirRequisicao(db: DB, id: number) {
  return !db.select({ id: pedidos.id }).from(pedidos).where(eq(pedidos.requisicaoId, id)).get();
}

/** Exclui a requisição com itens, propostas e envios. Só para o que nunca virou pedido. */
export function excluirRequisicao(db: DB, id: number) {
  if (!podeExcluirRequisicao(db, id))
    throw new Error("Esta cotação já teve pedido (mesmo cancelado): para manter o histórico, use Cancelar em vez de Excluir.");
  db.delete(requisicoes).where(eq(requisicoes.id, id)).run();
}

export function reabrirRequisicao(db: DB, id: number) {
  db.update(requisicoes).set({ status: "aberta" }).where(eq(requisicoes.id, id)).run();
  recalcularStatusRequisicao(db, id);
}

/**
 * Recalcula o status da requisição a partir dos dados:
 * com pedidos ativos, o status segue os pedidos; sem pedidos, segue a cotação.
 */
export function recalcularStatusRequisicao(db: DB, id: number) {
  const req = db.select().from(requisicoes).where(eq(requisicoes.id, id)).get();
  if (!req || req.status === "cancelada") return;

  const ativos = db
    .select({ status: pedidos.status })
    .from(pedidos)
    .where(and(eq(pedidos.requisicaoId, id), sql`${pedidos.status} != 'cancelado'`))
    .all()
    .map((p) => p.status);

  if (ativos.length) {
    let novoP: StatusRequisicao;
    if (ativos.includes("aguardando_aprovacao")) novoP = "aguardando_aprovacao";
    else if (ativos.every((s) => s === "entregue")) novoP = "entregue";
    else if (ativos.every((s) => s === "aprovado")) novoP = "aprovada";
    else novoP = "pedido_emitido";
    if (novoP !== req.status) db.update(requisicoes).set({ status: novoP }).where(eq(requisicoes.id, id)).run();
    return;
  }

  const totalItens = db
    .select({ n: sql<number>`count(*)` })
    .from(requisicaoItens)
    .where(eq(requisicaoItens.requisicaoId, id))
    .get()!.n;
  const qtdPropostas = db
    .select({ n: sql<number>`count(*)` })
    .from(propostas)
    .where(eq(propostas.requisicaoId, id))
    .get()!.n;
  const itensComVencedor = db
    .select({ n: sql<number>`count(distinct ${propostaItens.requisicaoItemId})` })
    .from(propostaItens)
    .innerJoin(propostas, eq(propostas.id, propostaItens.propostaId))
    .where(and(eq(propostas.requisicaoId, id), eq(propostaItens.vencedora, true)))
    .get()!.n;

  let novo: StatusRequisicao = "aberta";
  if (totalItens > 0 && itensComVencedor === totalItens) novo = "aguardando_aprovacao";
  else if (qtdPropostas > 0) novo = "cotando";

  if (novo !== req.status) db.update(requisicoes).set({ status: novo }).where(eq(requisicoes.id, id)).run();
}

// -------------------------------------------------------------- propostas

export function listarPropostas(db: DB, requisicaoId: number): MapaPropostaEntrada[] {
  const cab = db
    .select({
      id: propostas.id,
      fornecedorId: propostas.fornecedorId,
      fornecedor: nomeFornecedorSql,
      freteCentavos: propostas.freteCentavos,
      condicaoPagamento: propostas.condicaoPagamento,
      descontoAVistaBp: propostas.descontoAVistaBp,
      prazoEntregaDias: propostas.prazoEntregaDias,
      prazoObservacao: propostas.prazoObservacao,
      impostosInclusos: propostas.impostosInclusos,
      numeroOrcamento: propostas.numeroOrcamento,
      vendedor: propostas.vendedor,
      validade: propostas.validade,
      dataCotacao: propostas.dataCotacao,
      totalDocumentoCentavos: propostas.totalDocumentoCentavos,
      descontoNegociadoCentavos: propostas.descontoNegociadoCentavos,
    })
    .from(propostas)
    .innerJoin(fornecedores, eq(fornecedores.id, propostas.fornecedorId))
    .where(eq(propostas.requisicaoId, requisicaoId))
    .orderBy(asc(propostas.id))
    .all();
  if (!cab.length) return [];
  const itens = db
    .select()
    .from(propostaItens)
    .where(inArray(propostaItens.propostaId, cab.map((c) => c.id)))
    .all();
  return cab.map((c) => ({
    ...c,
    itens: itens
      .filter((i) => i.propostaId === c.id)
      .map((i) => ({
        requisicaoItemId: i.requisicaoItemId,
        precoUnitarioCentavos: i.precoUnitarioCentavos,
        totalCentavos: i.totalCentavos,
        quantidadeCotada: i.quantidadeCotada,
        unidadeCotada: i.unidadeCotada,
        disponivel: i.disponivel,
        vencedora: i.vencedora,
        marca: i.marca,
      })),
  }));
}

export function obterProposta(db: DB, propostaId: number) {
  const p = db.select().from(propostas).where(eq(propostas.id, propostaId)).get();
  if (!p) return null;
  const itens = db.select().from(propostaItens).where(eq(propostaItens.propostaId, propostaId)).all();
  return { ...p, itens };
}

function garantirEditavel(db: DB, requisicaoId: number) {
  const req = db.select().from(requisicoes).where(eq(requisicoes.id, requisicaoId)).get();
  if (!req) throw new Error("Requisição não encontrada");
  if (!["aberta", "cotando", "aguardando_aprovacao"].includes(req.status) || temPedidosAtivos(db, requisicaoId))
    throw new Error("Já existem pedidos para esta requisição. Cancele-os para alterar a cotação.");
  return req;
}

export function temPedidosAtivos(db: DB, requisicaoId: number) {
  return !!db
    .select({ id: pedidos.id })
    .from(pedidos)
    .where(and(eq(pedidos.requisicaoId, requisicaoId), sql`${pedidos.status} != 'cancelado'`))
    .get();
}

/** Cria ou substitui a proposta de um fornecedor para a requisição. */
export function salvarProposta(db: DB, entrada: PropostaInput) {
  const dados = propostaSchema.parse(entrada);
  garantirEditavel(db, dados.requisicaoId);

  const idsDaRequisicao = new Set(
    db
      .select({ id: requisicaoItens.id })
      .from(requisicaoItens)
      .where(eq(requisicaoItens.requisicaoId, dados.requisicaoId))
      .all()
      .map((r) => r.id),
  );
  for (const i of dados.itens)
    if (!idsDaRequisicao.has(i.requisicaoItemId))
      throw new Error(`Item ${i.requisicaoItemId} não pertence à requisição ${dados.requisicaoId}`);

  // Centavo a centavo com o documento do fornecedor (é o valor que vai para o financeiro e para a NF).
  if (dados.totalDocumentoCentavos != null) {
    const qtd = new Map(
      db.select({ id: requisicaoItens.id, q: requisicaoItens.quantidade }).from(requisicaoItens).where(eq(requisicaoItens.requisicaoId, dados.requisicaoId)).all().map((r) => [r.id, r.q]),
    );
    const c = conferirTotalProposta(
      dados.itens.map((i) => ({ ...i, quantidade: qtd.get(i.requisicaoItemId) ?? 0 })),
      dados.freteCentavos,
      dados.totalDocumentoCentavos,
    );
    if (!c.confere)
      throw new Error(
        `O total não bate com o orçamento: documento ${formatarReais(dados.totalDocumentoCentavos)}, soma ${formatarReais(c.soma)} (diferença ${formatarReais(c.diferenca)}). Confira frete, impostos e o valor de cada linha.`,
      );
  }

  const id = db.transaction((tx) => {
    const { itens, ...cab } = dados;
    const existente = tx
      .select()
      .from(propostas)
      .where(and(eq(propostas.requisicaoId, cab.requisicaoId), eq(propostas.fornecedorId, cab.fornecedorId)))
      .get();

    let pid: number;
    let vencedorasAntes = new Set<number>();
    if (existente) {
      pid = existente.id;
      vencedorasAntes = new Set(
        tx
          .select({ id: propostaItens.requisicaoItemId })
          .from(propostaItens)
          .where(and(eq(propostaItens.propostaId, pid), eq(propostaItens.vencedora, true)))
          .all()
          .map((r) => r.id),
      );
      tx.update(propostas)
        .set({
          ...cab,
          prazoEntregaDias: cab.prazoEntregaDias ?? null,
          validade: cab.validade ?? null,
          arquivoOrigem: cab.arquivoOrigem ?? existente.arquivoOrigem,
        })
        .where(eq(propostas.id, pid))
        .run();
      tx.delete(propostaItens).where(eq(propostaItens.propostaId, pid)).run();
    } else {
      pid = tx
        .insert(propostas)
        .values({ ...cab, prazoEntregaDias: cab.prazoEntregaDias ?? null, validade: cab.validade ?? null })
        .returning({ id: propostas.id })
        .get().id;
    }
    tx.insert(propostaItens)
      .values(
        itens.map((i) => ({
          ...i,
          propostaId: pid,
          vencedora: vencedorasAntes.has(i.requisicaoItemId) && i.disponivel,
        })),
      )
      .run();
    return pid;
  });

  recalcularStatusRequisicao(db, dados.requisicaoId);
  return id;
}

export function excluirProposta(db: DB, propostaId: number) {
  const p = db.select().from(propostas).where(eq(propostas.id, propostaId)).get();
  if (!p) return;
  garantirEditavel(db, p.requisicaoId);
  db.transaction((tx) => {
    soltarDePedidosCancelados(tx as unknown as DB, { propostaIds: [propostaId] });
    tx.delete(propostas).where(eq(propostas.id, propostaId)).run();
  });
  recalcularStatusRequisicao(db, p.requisicaoId);
}

/**
 * Pedidos cancelados continuam no histórico apontando para itens e propostas. Antes de excluir esses
 * registros, solta a referência (senão o banco recusa a exclusão).
 */
export function soltarDePedidosCancelados(db: DB, ref: { requisicaoItemIds?: number[]; propostaIds?: number[] }) {
  if (ref.requisicaoItemIds?.length)
    db.update(pedidoItens).set({ requisicaoItemId: null }).where(inArray(pedidoItens.requisicaoItemId, ref.requisicaoItemIds)).run();
  if (ref.propostaIds?.length) db.update(pedidos).set({ propostaId: null }).where(inArray(pedidos.propostaId, ref.propostaIds)).run();
}

/** Define (ou remove, com propostaId null) o vencedor de um item. */
export function marcarVencedorItem(db: DB, requisicaoItemId: number, propostaId: number | null) {
  const item = db.select().from(requisicaoItens).where(eq(requisicaoItens.id, requisicaoItemId)).get();
  if (!item) throw new Error("Item não encontrado");
  garantirEditavel(db, item.requisicaoId);

  db.transaction((tx) => {
    tx.update(propostaItens)
      .set({ vencedora: false })
      .where(eq(propostaItens.requisicaoItemId, requisicaoItemId))
      .run();
    if (propostaId) {
      const r = tx
        .update(propostaItens)
        .set({ vencedora: true })
        .where(
          and(
            eq(propostaItens.requisicaoItemId, requisicaoItemId),
            eq(propostaItens.propostaId, propostaId),
            eq(propostaItens.disponivel, true),
          ),
        )
        .run();
      if (r.changes === 0) throw new Error("Este fornecedor não cotou o item");
    }
  });
  recalcularStatusRequisicao(db, item.requisicaoId);
}

/** Marca como vencedor o menor preço de cada item (desempate: menor frete). */
export function marcarMenoresPrecos(db: DB, requisicaoId: number) {
  const mapa = obterMapa(db, requisicaoId);
  if (!mapa) throw new Error("Requisição não encontrada");
  garantirEditavel(db, requisicaoId);
  const fretes = new Map(mapa.propostas.map((p) => [p.id, p.freteCentavos]));
  const marcadas = new Set<number>();
  db.transaction((tx) => {
    for (const l of mapa.resumo.linhas) {
      tx.update(propostaItens).set({ vencedora: false }).where(eq(propostaItens.requisicaoItemId, l.item.id)).run();
      if (l.menorTotal == null) continue;
      const cands = l.celulas.filter((c) => c.totalLiquido === l.menorTotal);
      const esc =
        cands.find((c) => marcadas.has(c.propostaId)) ??
        cands.sort((a, b) => (fretes.get(a.propostaId) ?? 0) - (fretes.get(b.propostaId) ?? 0))[0];
      marcadas.add(esc.propostaId);
      tx.update(propostaItens)
        .set({ vencedora: true })
        .where(and(eq(propostaItens.requisicaoItemId, l.item.id), eq(propostaItens.propostaId, esc.propostaId)))
        .run();
    }
  });
  recalcularStatusRequisicao(db, requisicaoId);
}

/** Marca um fornecedor como vencedor de todos os itens que ele cotou. */
export function marcarFornecedorVencedor(db: DB, requisicaoId: number, propostaId: number) {
  const prop = db.select({ requisicaoId: propostas.requisicaoId }).from(propostas).where(eq(propostas.id, propostaId)).get();
  if (!prop || prop.requisicaoId !== requisicaoId) throw new Error("Proposta não pertence a esta requisição");
  garantirEditavel(db, requisicaoId);
  const itensCotados = db
    .select({ id: propostaItens.requisicaoItemId })
    .from(propostaItens)
    .where(and(eq(propostaItens.propostaId, propostaId), eq(propostaItens.disponivel, true)))
    .all()
    .map((r) => r.id);
  db.transaction((tx) => {
    if (itensCotados.length)
      tx.update(propostaItens)
        .set({ vencedora: false })
        .where(inArray(propostaItens.requisicaoItemId, itensCotados))
        .run();
    tx.update(propostaItens)
      .set({ vencedora: true })
      .where(and(eq(propostaItens.propostaId, propostaId), eq(propostaItens.disponivel, true)))
      .run();
  });
  recalcularStatusRequisicao(db, requisicaoId);
}

export function limparVencedores(db: DB, requisicaoId: number) {
  garantirEditavel(db, requisicaoId);
  db.run(
    sql`update proposta_itens set vencedora = 0 where proposta_id in (select id from propostas where requisicao_id = ${requisicaoId})`,
  );
  recalcularStatusRequisicao(db, requisicaoId);
}

// ------------------------------------------------------------------ mapa

export function obterMapa(db: DB, requisicaoId: number) {
  const req = obterRequisicao(db, requisicaoId);
  if (!req) return null;
  const itens: MapaItemEntrada[] = req.itens.map((i) => ({
    id: i.id,
    materialId: i.materialId,
    material: i.material,
    unidade: i.unidade,
    quantidade: i.quantidade,
    especificacao: i.especificacao,
  }));
  const props = listarPropostas(db, requisicaoId);
  return { requisicao: req, propostas: props, resumo: calcularMapa(itens, props) };
}

export type MapaCompleto = NonNullable<ReturnType<typeof obterMapa>>;

/** Último preço pago por material (para referência no mapa). */
export function ultimosPrecosPagos(db: DB, materialIds: number[], antesDe?: string) {
  if (!materialIds.length) return new Map<number, { preco: number; data: string; fornecedor: string }>();
  const linhas = db.all<{ material_id: number; preco: number; data: string; fornecedor: string }>(sql`
    select pi.material_id, pi.preco_unitario_centavos as preco, p.data_emissao as data, f.nome as fornecedor
    from pedido_itens pi
    join pedidos p on p.id = pi.pedido_id
    join fornecedores f on f.id = p.fornecedor_id
    where pi.material_id in (${sql.join(materialIds.map((m) => sql`${m}`), sql`, `)})
      and p.status not in ('cancelado', 'aguardando_aprovacao')
      and p.data_emissao is not null
      ${antesDe ? sql`and p.data_emissao <= ${antesDe}` : sql``}
    order by p.data_emissao desc, p.id desc
  `);
  const mapa = new Map<number, { preco: number; data: string; fornecedor: string }>();
  for (const l of linhas)
    if (!mapa.has(l.material_id)) mapa.set(l.material_id, { preco: l.preco, data: l.data, fornecedor: l.fornecedor });
  return mapa;
}
