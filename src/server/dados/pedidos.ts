// Pedidos de compra: geração a partir dos vencedores, aprovação, emissão,
// entregas e avaliação do fornecedor.
import { and, asc, desc, eq, inArray, like, sql, type SQL } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  propostaItens,
  propostas,
  requisicaoItens,
  avaliacoesFornecedor,
  entregas,
  fornecedores,
  materiais,
  obras,
  pedidoItens,
  pedidos,
  requisicoes,
  type StatusPedido,
} from "@/db/schema";
import { hojeISO, somarDias } from "@/lib/datas";
import {
  aprovacaoSchema,
  edicaoPedidoSchema,
  type EdicaoPedidoInput,
  avaliacaoSchema,
  emissaoSchema,
  entregaSchema,
  gerarPedidosSchema,
  type AprovacaoInput,
  type AvaliacaoInput,
  type EmissaoInput,
  type EntregaInput,
  type GerarPedidosInput,
} from "@/lib/validacao";
import { obterMapa, recalcularStatusRequisicao, temPedidosAtivos } from "./requisicoes";

/** Valor com desconto à vista aplicado sobre o total dos itens (centavos), como na nota fiscal. */
export function aplicarDesconto(valorCentavos: number, descontoBp: number) {
  return descontoBp > 0 ? Math.round((valorCentavos * (10000 - descontoBp)) / 10000) : valorCentavos;
}

/** Prévia dos pedidos que serão gerados a partir dos vencedores do mapa. */
export function previaPedidos(db: DB, requisicaoId: number) {
  const mapa = obterMapa(db, requisicaoId);
  if (!mapa) throw new Error("Requisição não encontrada");
  const { resumo } = mapa;
  return resumo.colunas
    .filter((c) => c.itensVencidos > 0)
    .map((c) => ({
      propostaId: c.proposta.id,
      fornecedorId: c.proposta.fornecedorId,
      fornecedor: c.proposta.fornecedor,
      condicaoPagamento: c.proposta.condicaoPagamento,
      descontoAVistaBp: c.proposta.descontoAVistaBp ?? 0,
      prazoEntregaDias: c.proposta.prazoEntregaDias,
      freteCentavos: c.proposta.freteCentavos,
      itens: resumo.linhas
        .filter((l) => l.propostaEscolhidaId === c.proposta.id)
        .map((l) => ({
          requisicaoItemId: l.item.id,
          materialId: l.item.materialId,
          material: l.item.material,
          unidade: l.item.unidade,
          quantidade: l.item.quantidade,
          precoUnitarioCentavos: l.precoEscolhido!,
          totalCentavos: l.totalEscolhido!,
        })),
      /** Parte do desconto negociado que cabe aos itens deste pedido. */
      descontoNegociado: c.valorVencidoBruto - c.valorVencido,
      totalPrazo: c.valorVencido + c.proposta.freteCentavos,
      totalAVista:
        (c.proposta.descontoAVistaBp ?? 0) > 0 ? aplicarDesconto(c.valorVencido, c.proposta.descontoAVistaBp ?? 0) + c.proposta.freteCentavos : null,
    }));
}

export type PreviaPedido = ReturnType<typeof previaPedidos>[number];

/** Gera um pedido (aguardando aprovação) por fornecedor vencedor. */
export function gerarPedidos(db: DB, entrada: GerarPedidosInput) {
  const dados = gerarPedidosSchema.parse(entrada);
  const mapa = obterMapa(db, dados.requisicaoId);
  if (!mapa) throw new Error("Requisição não encontrada");
  if (temPedidosAtivos(db, dados.requisicaoId)) throw new Error("Os pedidos desta requisição já foram gerados");
  if (mapa.resumo.itensComVencedor < mapa.resumo.totalItens)
    throw new Error(`Defina o vencedor de todos os itens (${mapa.resumo.itensComVencedor}/${mapa.resumo.totalItens})`);

  const previa = previaPedidos(db, dados.requisicaoId);
  const ids = db.transaction((tx) => {
    const criados: number[] = [];
    for (const p of previa) {
      const forma = dados.formas[String(p.propostaId)] ?? "prazo";
      const desconto = forma === "avista" ? p.descontoAVistaBp : 0;
      const linhas = p.itens.map((i) => ({ ...i, preco: i.precoUnitarioCentavos }));
      const valorItens = aplicarDesconto(
        linhas.reduce((s, l) => s + l.totalCentavos, 0) - p.descontoNegociado,
        desconto,
      );
      const condicao = forma === "avista" ? (desconto ? `À vista (−${(desconto / 100).toLocaleString("pt-BR")}%)` : "À vista") : p.condicaoPagamento;
      const id = tx
        .insert(pedidos)
        .values({
          requisicaoId: dados.requisicaoId,
          fornecedorId: p.fornecedorId,
          propostaId: p.propostaId,
          valorTotalCentavos: valorItens + p.freteCentavos,
          freteCentavos: p.freteCentavos,
          condicaoPagamento: condicao,
          formaPagamento: forma,
          descontoBp: desconto,
          descontoNegociadoCentavos: p.descontoNegociado,
          prazoEntregaDias: p.prazoEntregaDias,
          status: "aguardando_aprovacao",
          observacoes: dados.observacoes,
        })
        .returning({ id: pedidos.id })
        .get().id;
      tx.insert(pedidoItens)
        .values(
          linhas.map((l) => ({
            pedidoId: id,
            requisicaoItemId: l.requisicaoItemId,
            materialId: l.materialId,
            quantidade: l.quantidade,
            precoUnitarioCentavos: l.preco,
            totalCentavos: l.totalCentavos,
          })),
        )
        .run();
      criados.push(id);
    }
    return criados;
  });
  recalcularStatusRequisicao(db, dados.requisicaoId);
  return ids;
}

/**
 * Itens que ficaram sem fornecedor no fechamento vão para uma requisição de SALDO
 * (mesma obra e dados), que segue em cotação com outros fornecedores.
 */
export function separarSaldo(db: DB, requisicaoId: number, itemIds?: number[], motivo?: string) {
  const mapa = obterMapa(db, requisicaoId);
  if (!mapa) throw new Error("Requisição não encontrada");
  const faltando = itemIds ?? mapa.resumo.linhas.filter((l) => l.propostaEscolhidaId == null).map((l) => l.item.id);
  if (!faltando.length) return null;
  if (!itemIds && faltando.length === mapa.resumo.linhas.length) throw new Error("Escolha o fornecedor de pelo menos um item");
  const r = db.select().from(requisicoes).where(eq(requisicoes.id, requisicaoId)).get()!;
  return db.transaction((tx) => {
    const saldoId = tx
      .insert(requisicoes)
      .values({
        obraId: r.obraId,
        solicitante: r.solicitante,
        dataPedido: r.dataPedido,
        dataNecessidade: r.dataNecessidade,
        urgente: r.urgente,
        origemTexto: r.origemTexto,
        observacoes: [
          `Saldo da requisição #${requisicaoId}: ${motivo ?? "itens que não foram fechados com os primeiros fornecedores."}`,
          r.observacoes,
        ]
          .filter(Boolean)
          .join("\n"),
        status: "aberta",
      })
      .returning({ id: requisicoes.id })
      .get().id;
    // O desconto negociado era sobre todos os itens da proposta: ao tirar itens, reduz na mesma proporção.
    for (const c of mapa.resumo.colunas) {
      const neg = c.proposta.descontoNegociadoCentavos ?? 0;
      if (!neg || !c.subtotal) continue;
      const saem = mapa.resumo.linhas.filter((l) => faltando.includes(l.item.id)).reduce((s, l) => s + (l.celulas.find((x) => x.propostaId === c.proposta.id)?.total ?? 0), 0);
      if (saem) tx.update(propostas).set({ descontoNegociadoCentavos: Math.round((neg * (c.subtotal - saem)) / c.subtotal) }).where(eq(propostas.id, c.proposta.id)).run();
    }
    tx.delete(propostaItens).where(inArray(propostaItens.requisicaoItemId, faltando)).run();
    tx.update(requisicaoItens).set({ requisicaoId: saldoId }).where(inArray(requisicaoItens.id, faltando)).run();
    return saldoId;
  });
}

/** Fecha a cotação: separa o saldo (itens sem fornecedor) e gera os pedidos do que foi fechado. */
export function fecharCotacao(db: DB, entrada: GerarPedidosInput & { separarSaldo?: boolean }) {
  return db.transaction((tx) => {
    const t = tx as unknown as DB;
    const saldoId = entrada.separarSaldo ? separarSaldo(t, entrada.requisicaoId) : null;
    const pedidos = gerarPedidos(t, entrada);
    return { pedidos, saldoId };
  });
}

// ---------------------------------------------------------------- leitura

export type FiltroPedidos = {
  status?: StatusPedido | "em_aberto" | "atrasados";
  obraId?: number;
  fornecedorId?: number;
  requisicaoId?: number;
  busca?: string;
};

export function listarPedidos(db: DB, filtro: FiltroPedidos = {}, hoje = hojeISO()) {
  const cond: SQL[] = [];
  if (filtro.status === "em_aberto") cond.push(inArray(pedidos.status, ["aguardando_aprovacao", "aprovado", "emitido", "entregue_parcial"]));
  else if (filtro.status === "atrasados")
    cond.push(sql`${pedidos.status} in ('emitido','entregue_parcial') and ${pedidos.prazoPrometido} < ${hoje}`);
  else if (filtro.status) cond.push(eq(pedidos.status, filtro.status));
  if (filtro.obraId) cond.push(eq(requisicoes.obraId, filtro.obraId));
  if (filtro.fornecedorId) cond.push(eq(pedidos.fornecedorId, filtro.fornecedorId));
  if (filtro.requisicaoId) cond.push(eq(pedidos.requisicaoId, filtro.requisicaoId));
  if (filtro.busca) {
    const b = `%${filtro.busca.toLowerCase()}%`;
    cond.push(sql`(lower(coalesce(${pedidos.numero}, '')) like ${b} or lower(${fornecedores.nome}) like ${b} or cast(${pedidos.requisicaoId} as text) like ${b})`);
  }
  return db
    .select({
      id: pedidos.id,
      numero: pedidos.numero,
      status: pedidos.status,
      requisicaoId: pedidos.requisicaoId,
      fornecedorId: pedidos.fornecedorId,
      fornecedor: fornecedores.nome,
      obra: obras.nome,
      valorTotalCentavos: pedidos.valorTotalCentavos,
      formaPagamento: pedidos.formaPagamento,
      condicaoPagamento: pedidos.condicaoPagamento,
      dataEmissao: pedidos.dataEmissao,
      prazoPrometido: pedidos.prazoPrometido,
      aprovadoPor: pedidos.aprovadoPor,
      urgente: requisicoes.urgente,
      dataNecessidade: requisicoes.dataNecessidade,
      ultimaEntrega: sql<string | null>`(select max(e.data_real) from entregas e where e.pedido_id = pedidos.id)`,
      avaliado: sql<number>`exists(select 1 from avaliacoes_fornecedor a where a.pedido_id = pedidos.id)`,
      resumoItens: sql<string>`(select group_concat(m.nome_padronizado, ' · ') from (select m.nome_padronizado from pedido_itens pi join materiais m on m.id = pi.material_id where pi.pedido_id = pedidos.id order by pi.id limit 3) m)`,
    })
    .from(pedidos)
    .innerJoin(fornecedores, eq(fornecedores.id, pedidos.fornecedorId))
    .innerJoin(requisicoes, eq(requisicoes.id, pedidos.requisicaoId))
    .innerJoin(obras, eq(obras.id, requisicoes.obraId))
    .where(cond.length ? and(...cond) : undefined)
    .orderBy(
      sql`case ${pedidos.status} when 'aguardando_aprovacao' then 0 when 'aprovado' then 1 when 'emitido' then 2 when 'entregue_parcial' then 2 else 3 end`,
      asc(sql`coalesce(${pedidos.prazoPrometido}, '9999')`),
      desc(pedidos.id),
    )
    .all();
}

export type PedidoLista = ReturnType<typeof listarPedidos>[number];

export function obterPedido(db: DB, id: number) {
  const p = db
    .select({
      id: pedidos.id,
      numero: pedidos.numero,
      status: pedidos.status,
      requisicaoId: pedidos.requisicaoId,
      propostaId: pedidos.propostaId,
      valorTotalCentavos: pedidos.valorTotalCentavos,
      freteCentavos: pedidos.freteCentavos,
      condicaoPagamento: pedidos.condicaoPagamento,
      formaPagamento: pedidos.formaPagamento,
      descontoBp: pedidos.descontoBp,
      descontoNegociadoCentavos: pedidos.descontoNegociadoCentavos,
      prazoEntregaDias: pedidos.prazoEntregaDias,
      aprovadoPor: pedidos.aprovadoPor,
      dataAprovacao: pedidos.dataAprovacao,
      dataEmissao: pedidos.dataEmissao,
      prazoPrometido: pedidos.prazoPrometido,
      observacoes: pedidos.observacoes,
      motivoCancelamento: pedidos.motivoCancelamento,
      criadoEm: pedidos.criadoEm,
      fornecedorId: fornecedores.id,
      fornecedor: fornecedores.nome,
      fornecedorCnpj: fornecedores.cnpj,
      fornecedorContato: fornecedores.contato,
      fornecedorWhatsapp: fornecedores.whatsapp,
      fornecedorEmail: fornecedores.email,
      fornecedorCidade: fornecedores.cidade,
      obraId: obras.id,
      obra: obras.nome,
      // Faturamento corrigido no pedido tem prioridade sobre a ficha da obra.
      obraEndereco: sql<string | null>`coalesce(${pedidos.fatEndereco}, ${obras.endereco})`,
      obraCep: sql<string | null>`coalesce(${pedidos.fatCep}, ${obras.cep})`,
      obraRazaoSocial: sql<string | null>`coalesce(${pedidos.fatRazaoSocial}, ${obras.razaoSocial})`,
      obraCnpj: sql<string | null>`coalesce(${pedidos.fatCnpj}, ${obras.cnpj})`,
      obraCno: sql<string | null>`coalesce(${pedidos.fatCno}, ${obras.cno})`,
      fatRazaoSocial: pedidos.fatRazaoSocial,
      fatCnpj: pedidos.fatCnpj,
      fatCno: pedidos.fatCno,
      fatEndereco: pedidos.fatEndereco,
      fatCep: pedidos.fatCep,
      fichaRazaoSocial: obras.razaoSocial,
      fichaCnpj: obras.cnpj,
      fichaCno: obras.cno,
      fichaEndereco: obras.endereco,
      fichaCep: obras.cep,
      editadoEm: pedidos.editadoEm,
      solicitante: requisicoes.solicitante,
      dataRequisicao: requisicoes.dataPedido,
      dataNecessidade: requisicoes.dataNecessidade,
      urgente: requisicoes.urgente,
    })
    .from(pedidos)
    .innerJoin(fornecedores, eq(fornecedores.id, pedidos.fornecedorId))
    .innerJoin(requisicoes, eq(requisicoes.id, pedidos.requisicaoId))
    .innerJoin(obras, eq(obras.id, requisicoes.obraId))
    .where(eq(pedidos.id, id))
    .get();
  if (!p) return null;

  const itens = db
    .select({
      id: pedidoItens.id,
      materialId: pedidoItens.materialId,
      material: materiais.nomePadronizado,
      unidade: materiais.unidade,
      quantidade: pedidoItens.quantidade,
      precoUnitarioCentavos: pedidoItens.precoUnitarioCentavos,
      totalCentavos: sql<number>`coalesce(${pedidoItens.totalCentavos}, round(${pedidoItens.quantidade} * ${pedidoItens.precoUnitarioCentavos}))`,
      especificacao: sql<string | null>`(select ri.especificacao from requisicao_itens ri where ri.id = ${pedidoItens.requisicaoItemId})`,
      marca: sql<string | null>`(select pi2.marca from proposta_itens pi2 where pi2.proposta_id = ${p.propostaId ?? 0} and pi2.requisicao_item_id = ${pedidoItens.requisicaoItemId})`,
    })
    .from(pedidoItens)
    .innerJoin(materiais, eq(materiais.id, pedidoItens.materialId))
    .where(eq(pedidoItens.pedidoId, id))
    .orderBy(asc(pedidoItens.id))
    .all();

  const listaEntregas = db.select().from(entregas).where(eq(entregas.pedidoId, id)).orderBy(asc(entregas.dataReal), asc(entregas.id)).all();
  const avaliacao = db.select().from(avaliacoesFornecedor).where(eq(avaliacoesFornecedor.pedidoId, id)).get() ?? null;
  return { ...p, itens, entregas: listaEntregas, avaliacao };
}

export type PedidoDetalhe = NonNullable<ReturnType<typeof obterPedido>>;

/**
 * Corrige os dados do pedido (faturamento, prazo, pagamento, datas). Campo de faturamento igual à
 * ficha da obra fica vazio, para seguir a ficha.
 */
export function editarPedido(db: DB, id: number, entrada: EdicaoPedidoInput) {
  const d = edicaoPedidoSchema.parse(entrada);
  const p = obterPedido(db, id);
  if (!p) throw new Error("Pedido não encontrado");
  if (p.status === "cancelado") throw new Error("Pedido cancelado não pode ser editado");
  // Valida as datas como vão ficar (o que foi digitado + o que já estava).
  const aprovacao = d.dataAprovacao ?? p.dataAprovacao;
  const emissao = d.dataEmissao ?? p.dataEmissao;
  const prazo = d.prazoPrometido ?? p.prazoPrometido;
  if (d.dataEmissao && !p.numero) throw new Error("Este pedido ainda não foi emitido: use o botão Emitir para gerar o número.");
  if (aprovacao && emissao && emissao < aprovacao) throw new Error("A emissão não pode ser antes da aprovação");
  if (emissao && prazo && prazo < emissao) throw new Error("A entrega prometida não pode ser antes da emissão");
  const igual = (v: string | null | undefined, ficha: string | null) => (v && v !== (ficha ?? "") ? v : null);
  // Desconto conseguido depois de fechado: recalcula o total como na geração do pedido
  // (itens − desconto negociado, depois o desconto à vista, mais o frete).
  const itens = p.itens.reduce((s, i) => s + i.totalCentavos, 0);
  const frete = d.freteCentavos ?? p.freteCentavos;
  const negociado = d.descontoNegociadoCentavos ?? p.descontoNegociadoCentavos;
  if (negociado > itens) throw new Error("O desconto não pode ser maior que o valor dos itens");
  const valorTotalCentavos = aplicarDesconto(itens - negociado, p.descontoBp) + frete;
  db.update(pedidos)
    .set({
      freteCentavos: frete,
      descontoNegociadoCentavos: negociado,
      valorTotalCentavos,
      condicaoPagamento: d.condicaoPagamento ?? null,
      aprovadoPor: d.aprovadoPor ?? p.aprovadoPor,
      dataAprovacao: d.dataAprovacao ?? p.dataAprovacao,
      dataEmissao: d.dataEmissao ?? p.dataEmissao,
      prazoPrometido: d.prazoPrometido ?? p.prazoPrometido,
      observacoes: d.observacoes ?? null,
      fatRazaoSocial: igual(d.fatRazaoSocial, p.fichaRazaoSocial),
      fatCnpj: igual(d.fatCnpj, p.fichaCnpj),
      fatCno: igual(d.fatCno, p.fichaCno),
      fatEndereco: igual(d.fatEndereco, p.fichaEndereco),
      fatCep: igual(d.fatCep, p.fichaCep),
      editadoEm: sql`(datetime('now', 'localtime'))`,
    })
    .where(eq(pedidos.id, id))
    .run();
}

// ------------------------------------------------------------ transições

function carregar(db: DB, id: number) {
  const p = db.select().from(pedidos).where(eq(pedidos.id, id)).get();
  if (!p) throw new Error("Pedido não encontrado");
  return p;
}

export function aprovarPedido(db: DB, id: number, entrada: AprovacaoInput) {
  const dados = aprovacaoSchema.parse(entrada);
  const p = carregar(db, id);
  if (p.status !== "aguardando_aprovacao") throw new Error("Este pedido não está aguardando aprovação");
  db.update(pedidos).set({ ...dados, status: "aprovado" }).where(eq(pedidos.id, id)).run();
  recalcularStatusRequisicao(db, p.requisicaoId);
}

/** Próximo número sequencial do ano: PC-AAAA-0001. */
export function proximoNumero(db: DB, ano: string) {
  const ultimo = db
    .select({ numero: pedidos.numero })
    .from(pedidos)
    .where(like(pedidos.numero, `PC-${ano}-%`))
    .orderBy(desc(pedidos.numero))
    .get();
  const n = ultimo?.numero ? Number(ultimo.numero.split("-")[2]) + 1 : 1;
  return `PC-${ano}-${String(n).padStart(4, "0")}`;
}

export function emitirPedido(db: DB, id: number, entrada: EmissaoInput) {
  const dados = emissaoSchema.parse(entrada);
  if (dados.prazoPrometido < dados.dataEmissao) throw new Error("O prazo prometido não pode ser antes da emissão");
  const numero = db.transaction((tx) => {
    const p = tx.select().from(pedidos).where(eq(pedidos.id, id)).get();
    if (!p) throw new Error("Pedido não encontrado");
    if (p.status !== "aprovado") throw new Error("Aprove o pedido antes de emitir");
    const num = p.numero ?? proximoNumero(tx as unknown as DB, dados.dataEmissao.slice(0, 4));
    tx.update(pedidos).set({ ...dados, numero: num, status: "emitido" }).where(eq(pedidos.id, id)).run();
    return { num, requisicaoId: p.requisicaoId };
  });
  recalcularStatusRequisicao(db, numero.requisicaoId);
  return numero.num;
}

/** Atalho do dia a dia: aprova e emite em um passo. */
export function aprovarEEmitir(db: DB, id: number, entrada: AprovacaoInput & { prazoPrometido?: string }) {
  const p = carregar(db, id);
  aprovarPedido(db, id, entrada);
  const dataEmissao = entrada.dataAprovacao;
  const prazoPrometido = entrada.prazoPrometido || somarDias(dataEmissao, p.prazoEntregaDias ?? 0);
  return emitirPedido(db, id, { dataEmissao, prazoPrometido });
}

export function cancelarPedido(db: DB, id: number, motivo: string) {
  const p = carregar(db, id);
  if (["entregue", "entregue_parcial"].includes(p.status)) throw new Error("Pedido com entrega registrada não pode ser cancelado");
  if (!motivo.trim()) throw new Error("Informe o motivo do cancelamento");
  return db.transaction((tx) => {
    const t = tx as unknown as DB;
    t.update(pedidos).set({ status: "cancelado", motivoCancelamento: motivo.trim() }).where(eq(pedidos.id, id)).run();
    // A cotação tem outros pedidos ativos: os itens deste vão para uma requisição de saldo, para cotar de novo.
    let saldoId: number | null = null;
    if (temPedidosAtivos(t, p.requisicaoId)) {
      const itens = t
        .select({ id: pedidoItens.requisicaoItemId })
        .from(pedidoItens)
        .where(eq(pedidoItens.pedidoId, id))
        .all()
        .map((i) => i.id)
        .filter((x): x is number => x != null);
      saldoId = separarSaldo(t, p.requisicaoId, itens, `itens do pedido ${p.numero ?? `#${id}`} cancelado (${motivo.trim()}).`);
    }
    recalcularStatusRequisicao(t, p.requisicaoId);
    return { saldoId };
  });
}

export function registrarEntrega(db: DB, id: number, entrada: EntregaInput) {
  const dados = entregaSchema.parse(entrada);
  const p = carregar(db, id);
  if (!["emitido", "entregue_parcial"].includes(p.status)) throw new Error("Só é possível registrar entrega de pedido emitido");
  if (p.dataEmissao && dados.dataReal < p.dataEmissao) throw new Error("A entrega não pode ser antes da emissão do pedido");
  db.transaction((tx) => {
    tx.insert(entregas).values({ pedidoId: id, ...dados }).run();
    tx.update(pedidos)
      .set({ status: dados.parcial ? "entregue_parcial" : "entregue" })
      .where(eq(pedidos.id, id))
      .run();
  });
  recalcularStatusRequisicao(db, p.requisicaoId);
}

export function avaliarFornecedor(db: DB, pedidoId: number, entrada: AvaliacaoInput) {
  const dados = avaliacaoSchema.parse(entrada);
  carregar(db, pedidoId);
  db.insert(avaliacoesFornecedor)
    .values({ pedidoId, ...dados })
    .onConflictDoUpdate({ target: avaliacoesFornecedor.pedidoId, set: dados })
    .run();
}
