// Preparação e conferência de propostas (compartilhado por gravar-proposta e ler-planilha-cotacao).
import { and, eq } from "drizzle-orm";
import type { DB } from "../src/db/client";
import { propostas } from "../src/db/schema";
import { formatarData, hojeISO } from "../src/lib/datas";
import { totalItem } from "../src/lib/dinheiro";
import { normalizarTexto } from "../src/lib/normalizar";
import { conferirTotalProposta, type PropostaInput } from "../src/lib/validacao";
import { listarCategorias, listarFornecedores } from "../src/server/dados/cadastros";
import { obterRequisicao, ultimosPrecosPagos } from "../src/server/dados/requisicoes";
import { paraCentavos, reais } from "./_comum";

export type RascunhoProposta = {
  requisicaoId: number;
  fornecedor: string | number | { novo: { nome: string; cnpj?: string; contato?: string; whatsapp?: string; email?: string; cidade?: string; categorias?: string[] } };
  dataCotacao?: string;
  frete?: number | string;
  freteCentavos?: number;
  condicaoPagamento?: string;
  descontoAVistaPct?: number;
  prazoEntregaDias?: number | null;
  prazoObservacao?: string;
  impostosInclusos?: boolean;
  numeroOrcamento?: string;
  vendedor?: string;
  validade?: string | null;
  observacoes?: string;
  arquivoOrigem?: string;
  /** Total impresso no orçamento (produtos + frete + impostos). Com ele, a gravação confere centavo a centavo. */
  totalDocumento?: number | string;
  totalDocumentoCentavos?: number;
  itens: {
    requisicaoItemId: number;
    precoUnitario?: number | string;
    precoUnitarioCentavos?: number;
    /** Valor total da linha exatamente como no orçamento (reais). Obrigatório quando a unidade/quantidade difere. */
    total?: number | string;
    totalCentavos?: number;
    marca?: string;
    disponivel?: boolean;
    quantidadeCotada?: number;
    unidadeCotada?: string;
    descricaoOriginal?: string;
  }[];
};

export function prepararProposta(db: DB, r: RascunhoProposta) {
  const avisos: string[] = [];
  const req = obterRequisicao(db, Number(r.requisicaoId));
  if (!req) throw new Error(`Requisição ${r.requisicaoId} não encontrada`);
  if (!["aberta", "cotando", "aguardando_aprovacao"].includes(req.status))
    throw new Error(`Requisição #${req.id} está "${req.status}": não aceita novas propostas`);

  // Fornecedor: id, nome (aproximado) ou novo cadastro.
  const lista = listarFornecedores(db);
  let fornecedorId: number | null = null;
  let fornecedorNome = "";
  let novoFornecedor: { nome: string; cnpj?: string; contato?: string; whatsapp?: string; email?: string; cidade?: string; categoriaIds: number[] } | null = null;
  if (typeof r.fornecedor === "number") {
    const f = lista.find((x) => x.id === r.fornecedor);
    if (!f) throw new Error(`Fornecedor id ${r.fornecedor} não existe`);
    fornecedorId = f.id;
    fornecedorNome = f.nome;
  } else if (typeof r.fornecedor === "string") {
    const alvo = normalizarTexto(r.fornecedor);
    const f = lista.find((x) => normalizarTexto(x.nome) === alvo) ?? lista.find((x) => normalizarTexto(x.nome).includes(alvo) || alvo.includes(normalizarTexto(x.nome)));
    if (!f) throw new Error(`Fornecedor "${r.fornecedor}" não encontrado. Use { "novo": { ... } } para cadastrar. Existentes: ${lista.map((x) => x.nome).join(", ")}`);
    fornecedorId = f.id;
    fornecedorNome = f.nome;
  } else if (r.fornecedor?.novo) {
    const cats = listarCategorias(db);
    const categoriaIds = (r.fornecedor.novo.categorias ?? []).map((c) => {
      const cat = cats.find((x) => normalizarTexto(x.nome) === normalizarTexto(c));
      if (!cat) throw new Error(`Categoria "${c}" não existe. Use: ${cats.map((x) => x.nome).join(", ")}`);
      return cat.id;
    });
    novoFornecedor = { ...r.fornecedor.novo, categoriaIds };
    fornecedorNome = `${r.fornecedor.novo.nome} (NOVO)`;
    const parecido = lista.find((x) => normalizarTexto(x.nome).includes(normalizarTexto(r.fornecedor && typeof r.fornecedor === "object" ? r.fornecedor.novo.nome : "").slice(0, 8)));
    if (parecido) avisos.push(`Fornecedor novo parecido com "${parecido.nome}" (id ${parecido.id}). É o mesmo?`);
  } else throw new Error("Informe o fornecedor (nome, id ou { novo: {...} })");

  if (fornecedorId) {
    const existe = db.select({ id: propostas.id }).from(propostas).where(and(eq(propostas.requisicaoId, req.id), eq(propostas.fornecedorId, fornecedorId))).get();
    if (existe) avisos.push(`Já existe proposta de ${fornecedorNome} nesta requisição: gravar vai SUBSTITUIR a anterior.`);
  }

  const hoje = hojeISO();
  const ultimos = ultimosPrecosPagos(db, req.itens.map((i) => i.materialId));
  const itensReq = new Map(req.itens.map((i) => [i.id, i]));
  const vistos = new Set<number>();
  const linhas = r.itens.map((i, n) => {
    const it = itensReq.get(Number(i.requisicaoItemId));
    if (!it) throw new Error(`Item ${n + 1}: requisicaoItemId ${i.requisicaoItemId} não pertence à requisição #${req.id}. Ids válidos: ${req.itens.map((x) => `${x.id}=${x.material}`).join("; ")}`);
    vistos.add(it.id);
    const disponivel = i.disponivel ?? true;
    const totalLinha = i.totalCentavos ?? paraCentavos(i.total);
    // Com o total da linha, o unitário na unidade da requisição é só referência (total ÷ quantidade pedida).
    const preco = i.precoUnitarioCentavos ?? paraCentavos(i.precoUnitario) ?? (totalLinha != null ? Math.round(totalLinha / it.quantidade) : null);
    if (disponivel && (preco == null || preco <= 0)) throw new Error(`Item ${n + 1} (${it.material}): preço unitário inválido`);
    const difereQtd = i.quantidadeCotada != null && Math.abs(i.quantidadeCotada - it.quantidade) > 1e-9;
    const difereUn = !!i.unidadeCotada && normalizarTexto(i.unidadeCotada) !== normalizarTexto(it.unidade);
    if (disponivel && (difereQtd || difereUn)) {
      if (totalLinha == null)
        throw new Error(
          `Item ${n + 1} (${it.material}): cotado em ${i.quantidadeCotada?.toLocaleString("pt-BR") ?? "?"} ${i.unidadeCotada ?? it.unidade}, pedido ${it.quantidade.toLocaleString("pt-BR")} ${it.unidade}. Informe "total" da linha como está no orçamento.`,
        );
      avisos.push(
        `${it.material}: cotado ${i.quantidadeCotada?.toLocaleString("pt-BR") ?? ""} ${i.unidadeCotada ?? ""} — vale o total do orçamento ${reais(totalLinha)} (≈ ${reais(preco)}/${it.unidade}).`,
      );
    }
    const ult = ultimos.get(it.materialId)?.preco;
    if (disponivel && preco && ult) {
      const v = preco / ult - 1;
      if (Math.abs(v) >= 0.15) avisos.push(`${it.material}: preço ${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}% vs último pago (${reais(ult)}). Confira a unidade/embalagem.`);
    }
    const total = disponivel ? (totalLinha ?? totalItem(it.quantidade, preco ?? 0)) : 0;
    return {
      it,
      preco: preco ?? 0,
      total,
      totalCentavos: totalLinha,
      quantidadeCotada: i.quantidadeCotada ?? null,
      unidadeCotada: i.unidadeCotada ?? null,
      disponivel,
      marca: i.marca ?? i.descricaoOriginal ?? null,
      ultimo: ult ?? null,
    };
  });
  const faltando = req.itens.filter((i) => !vistos.has(i.id));
  if (faltando.length) avisos.push(`Não cotou: ${faltando.map((i) => i.material).join(", ")}.`);

  const freteCentavos = r.freteCentavos ?? paraCentavos(r.frete) ?? 0;
  if (r.frete == null && r.freteCentavos == null) avisos.push("Frete não informado: considerado CIF (R$ 0,00).");
  const descontoAVistaBp = Math.round((r.descontoAVistaPct ?? 0) * 100);
  if (r.impostosInclusos === false) avisos.push("Preços SEM IPI/impostos: o valor final será maior. Confirme a alíquota.");
  if (r.validade && r.validade < hoje) avisos.push(`Validade da proposta (${formatarData(r.validade)}) já venceu.`);
  if (r.prazoEntregaDias == null) avisos.push("Prazo de entrega não informado.");

  const subtotal = linhas.reduce((s, l) => s + l.total, 0);
  const totalDocumentoCentavos = r.totalDocumentoCentavos ?? paraCentavos(r.totalDocumento) ?? null;
  const conferencia = conferirTotalProposta(
    linhas.map((l) => ({ quantidade: l.it.quantidade, precoUnitarioCentavos: l.preco, totalCentavos: l.total, disponivel: l.disponivel })),
    freteCentavos,
    totalDocumentoCentavos,
  );
  if (totalDocumentoCentavos == null)
    avisos.push('Total do documento não informado ("totalDocumento"): não deu para conferir centavo a centavo com o orçamento.');
  else if (!conferencia.confere)
    throw new Error(
      `NÃO BATE com o orçamento: documento ${reais(totalDocumentoCentavos)} × soma ${reais(conferencia.soma)} (itens ${reais(subtotal)} + frete ${reais(freteCentavos)}), diferença ${reais(conferencia.diferenca)}. ` +
        "Use o valor total de cada linha do PDF, confira frete, IPI/ST e itens que não estão na requisição.",
    );
  const entrada: Omit<PropostaInput, "fornecedorId"> = {
    requisicaoId: req.id,
    freteCentavos,
    condicaoPagamento: r.condicaoPagamento ?? null,
    descontoAVistaBp,
    prazoEntregaDias: r.prazoEntregaDias ?? null,
    prazoObservacao: r.prazoObservacao ?? null,
    impostosInclusos: r.impostosInclusos ?? true,
    numeroOrcamento: r.numeroOrcamento ?? null,
    vendedor: r.vendedor ?? null,
    validade: r.validade ?? null,
    dataCotacao: r.dataCotacao ?? hoje,
    arquivoOrigem: r.arquivoOrigem ?? null,
    observacoes: r.observacoes ?? null,
    totalDocumentoCentavos,
    itens: linhas.map((l) => ({
      requisicaoItemId: l.it.id,
      precoUnitarioCentavos: l.preco,
      totalCentavos: l.totalCentavos,
      quantidadeCotada: l.quantidadeCotada,
      unidadeCotada: l.unidadeCotada,
      marca: l.marca,
      disponivel: l.disponivel,
    })),
  };
  return { req, fornecedorId, fornecedorNome, novoFornecedor, entrada, linhas, subtotal, freteCentavos, descontoAVistaBp, totalDocumentoCentavos, avisos };
}

export type PropostaPreparada = ReturnType<typeof prepararProposta>;
