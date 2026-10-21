// Pedir cotação: quais itens vão para cada fornecedor e quem já recebeu, foi cobrado e respondeu.
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { categorias, cotacaoEnvios, materiais, propostas } from "@/db/schema";
import { listarFornecedores } from "./cadastros";
import { obterRequisicao } from "./requisicoes";

/** Itens que o fornecedor atende (pelas categorias dele). Se ele não atende nenhuma, vai a lista toda. */
export function itensDoFornecedor<T extends { categoriaId: number }>(itens: T[], categoriaIds: number[]) {
  const dele = itens.filter((i) => categoriaIds.includes(i.categoriaId));
  return dele.length ? dele : itens;
}

/** Itens para o PDF/planilha: os escolhidos na tela (?itens=) ou, sem escolha, os que o fornecedor vende. */
export function itensParaFornecedor(db: DB, requisicaoId: number, fornecedorId: number | null, itemIds?: number[]) {
  const r = obterRequisicao(db, requisicaoId);
  if (!r) return [];
  if (itemIds?.length) {
    const escolhidos = r.itens.filter((i) => itemIds.includes(i.id));
    if (escolhidos.length) return escolhidos;
  }
  if (!fornecedorId) return r.itens;
  const f = listarFornecedores(db).find((x) => x.id === fornecedorId);
  return f ? itensDoFornecedor(r.itens, f.categoriaIds) : r.itens;
}

/** "1,2,3" → [1, 2, 3] (parâmetro ?itens= das rotas de PDF e planilha). */
export const lerIds = (v: unknown) =>
  typeof v === "string" ? v.split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0) : [];

/** Todos os fornecedores ativos com a situação nesta cotação (enviado, cobrado, respondeu). */
export function acompanhamentoCotacao(db: DB, requisicaoId: number) {
  const envios = new Map(
    db.select().from(cotacaoEnvios).where(eq(cotacaoEnvios.requisicaoId, requisicaoId)).all().map((e) => [e.fornecedorId, e]),
  );
  const respostas = new Map(
    db
      .all<{ fornecedor_id: number; criado_em: string; cotados: number; total: number }>(sql`
        select p.fornecedor_id, p.criado_em,
          (select count(*) from proposta_itens pi where pi.proposta_id = p.id and pi.disponivel = 1) cotados,
          p.frete_centavos + coalesce((select sum(round(pi.preco_unitario_centavos * ri.quantidade)) from proposta_itens pi
            join requisicao_itens ri on ri.id = pi.requisicao_item_id where pi.proposta_id = p.id and pi.disponivel = 1), 0) total
        from propostas p where p.requisicao_id = ${requisicaoId}`)
      .map((p) => [p.fornecedor_id, p]),
  );
  // Quem mais respondeu cotações antes aparece primeiro.
  const historico = new Map(
    db
      .select({ fornecedorId: propostas.fornecedorId, n: sql<number>`count(*)` })
      .from(propostas)
      .groupBy(propostas.fornecedorId)
      .all()
      .map((h) => [h.fornecedorId, h.n]),
  );
  return listarFornecedores(db, { somenteAtivos: true })
    .map((f) => {
      const envio = envios.get(f.id);
      const resposta = respostas.get(f.id);
      return {
        id: f.id,
        nome: f.nome,
        contato: f.contato,
        whatsapp: f.whatsapp,
        categoriaIds: f.categoriaIds,
        categorias: f.categorias,
        historico: historico.get(f.id) ?? 0,
        enviadoEm: envio?.enviadoEm ?? null,
        qtdEnviada: envio?.qtdItens ?? 0,
        cobradoEm: envio?.cobradoEm ?? null,
        respondeuEm: resposta?.criado_em ?? null,
        itensCotados: resposta?.cotados ?? 0,
        totalCotado: resposta?.total ?? null,
      };
    })
    .sort((a, b) => b.historico - a.historico || a.nome.localeCompare(b.nome));
}

export type FornecedorAcompanhamento = ReturnType<typeof acompanhamentoCotacao>[number];

export function registrarEnvio(db: DB, requisicaoId: number, fornecedorId: number, qtdItens: number) {
  db.insert(cotacaoEnvios)
    .values({ requisicaoId, fornecedorId, qtdItens })
    .onConflictDoUpdate({ target: [cotacaoEnvios.requisicaoId, cotacaoEnvios.fornecedorId], set: { qtdItens } })
    .run();
}

export function registrarCobranca(db: DB, requisicaoId: number, fornecedorId: number) {
  db.update(cotacaoEnvios)
    .set({ cobradoEm: sql`(datetime('now', 'localtime'))` })
    .where(and(eq(cotacaoEnvios.requisicaoId, requisicaoId), eq(cotacaoEnvios.fornecedorId, fornecedorId)))
    .run();
}

/** Corrige a categoria de um material (ele muda de lote em todas as requisições). */
export function mudarCategoriaMaterial(db: DB, materialId: number, categoriaId: number) {
  if (!db.select().from(categorias).where(eq(categorias.id, categoriaId)).get()) throw new Error("Categoria não encontrada");
  db.update(materiais).set({ categoriaId }).where(eq(materiais.id, materialId)).run();
}
