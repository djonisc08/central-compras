// Central de cotação: divide a requisição em lotes por categoria, diz quais itens vão para
// cada fornecedor e acompanha quem já recebeu, foi cobrado e respondeu.
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { categorias, cotacaoEnvios, materiais, propostas } from "@/db/schema";
import { listarFornecedores } from "./cadastros";
import { obterRequisicao } from "./requisicoes";

type ItemReq = NonNullable<ReturnType<typeof obterRequisicao>>["itens"][number];

/** Itens que o fornecedor atende (pelas categorias dele). Se ele não atende nenhuma, vai a lista toda. */
export function itensDoFornecedor<T extends { categoriaId: number }>(itens: T[], categoriaIds: number[]) {
  const dele = itens.filter((i) => categoriaIds.includes(i.categoriaId));
  return dele.length ? dele : itens;
}

export function itensParaFornecedor(db: DB, requisicaoId: number, fornecedorId: number | null) {
  const r = obterRequisicao(db, requisicaoId);
  if (!r) return [];
  if (!fornecedorId) return r.itens;
  const f = listarFornecedores(db).find((x) => x.id === fornecedorId);
  return f ? itensDoFornecedor(r.itens, f.categoriaIds) : r.itens;
}

export function quadroCotacao(db: DB, requisicaoId: number) {
  const r = obterRequisicao(db, requisicaoId);
  if (!r) return null;
  const nomesCat = new Map(db.select().from(categorias).all().map((c) => [c.id, c.nome]));
  const fornecedores = listarFornecedores(db, { somenteAtivos: true });
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

  const porCategoria = Map.groupBy(r.itens, (i) => i.categoriaId);
  const lotes = [...porCategoria].map(([categoriaId, itens]) => {
    const atendem = fornecedores
      .filter((f) => f.categoriaIds.includes(categoriaId))
      .sort((a, b) => (historico.get(b.id) ?? 0) - (historico.get(a.id) ?? 0) || a.nome.localeCompare(b.nome));
    return {
      categoriaId,
      categoria: nomesCat.get(categoriaId) ?? "Sem categoria",
      itens,
      fornecedores: atendem.map((f) => {
        const seus = itensDoFornecedor(r.itens, f.categoriaIds);
        const envio = envios.get(f.id);
        const resposta = respostas.get(f.id);
        return {
          id: f.id,
          nome: f.nome,
          contato: f.contato,
          whatsapp: f.whatsapp,
          itens: seus as ItemReq[],
          /** Outros lotes que vão junto na mesma mensagem. */
          outrosLotes: [...new Set(seus.filter((i) => i.categoriaId !== categoriaId).map((i) => nomesCat.get(i.categoriaId) ?? ""))],
          enviadoEm: envio?.enviadoEm ?? null,
          cobradoEm: envio?.cobradoEm ?? null,
          respondeuEm: resposta?.criado_em ?? null,
          itensCotados: resposta?.cotados ?? 0,
          totalCotado: resposta?.total ?? null,
        };
      }),
    };
  });
  lotes.sort((a, b) => b.itens.length - a.itens.length || a.categoria.localeCompare(b.categoria));
  return { requisicao: r, lotes };
}

export type LoteCotacao = NonNullable<ReturnType<typeof quadroCotacao>>["lotes"][number];

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
