// Leitura e gravação de cadastros. Recebe o db por parâmetro para servir
// tanto às telas quanto aos scripts de ./scripts.
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import {
  categorias,
  fornecedorCategorias,
  fornecedores,
  materialSinonimos,
  materiais,
  obras,
  requisicoes,
} from "@/db/schema";
import { normalizarTexto, normalizarWhatsapp, type CandidatoMaterial } from "@/lib/normalizar";
import {
  fornecedorSchema,
  materialSchema,
  obraSchema,
  type FornecedorInput,
  type MaterialInput,
  type ObraInput,
} from "@/lib/validacao";

// ----------------------------------------------------------------- obras

export function listarObras(db: DB) {
  return db
    .select({
      id: obras.id,
      nome: obras.nome,
      endereco: obras.endereco,
      cep: obras.cep,
      engenheiroResponsavel: obras.engenheiroResponsavel,
      status: obras.status,
      razaoSocial: obras.razaoSocial,
      cnpj: obras.cnpj,
      cno: obras.cno,
      requisicoesAbertas: sql<number>`(select count(*) from requisicoes r where r.obra_id = obras.id and r.status in ('aberta','cotando','aguardando_aprovacao','aprovada'))`,
      gastoTotal: sql<number>`coalesce((select sum(p.valor_total_centavos) from pedidos p join requisicoes r on r.id = p.requisicao_id where r.obra_id = obras.id and p.status not in ('cancelado','aguardando_aprovacao')), 0)`,
    })
    .from(obras)
    .orderBy(sql`case ${obras.status} when 'ativa' then 0 when 'planejada' then 1 else 2 end`, asc(obras.nome))
    .all();
}

/**
 * Exclui a obra cadastrada por engano. Obra com requisições fica protegida (histórico de compras):
 * nesse caso marque como "Concluída", que tira das listas de novas requisições.
 */
export function excluirObra(db: DB, id: number) {
  const n = db.select({ n: sql<number>`count(*)` }).from(requisicoes).where(eq(requisicoes.obraId, id)).get()?.n ?? 0;
  if (n > 0)
    throw new Error(
      `Esta obra tem ${n} requisição(ões) no histórico e não pode ser excluída. Para tirá-la das listas, edite e marque o status como "Concluída".`,
    );
  db.delete(obras).where(eq(obras.id, id)).run();
}

export function salvarObra(db: DB, entrada: ObraInput, id?: number) {
  const dados = obraSchema.parse(entrada);
  if (id) {
    db.update(obras).set(dados).where(eq(obras.id, id)).run();
    return id;
  }
  return db.insert(obras).values(dados).returning({ id: obras.id }).get().id;
}

// ------------------------------------------------------------ categorias

export function listarCategorias(db: DB) {
  return db.select().from(categorias).orderBy(asc(categorias.nome)).all();
}

export function criarCategoria(db: DB, nome: string) {
  const n = nome.trim();
  if (n.length < 2) throw new Error("Nome da categoria muito curto");
  const existente = db
    .select()
    .from(categorias)
    .where(sql`lower(${categorias.nome}) = lower(${n})`)
    .get();
  if (existente) return existente.id;
  return db.insert(categorias).values({ nome: n }).returning({ id: categorias.id }).get().id;
}

// ---------------------------------------------------------- fornecedores

export function listarFornecedores(db: DB, opcoes: { somenteAtivos?: boolean } = {}) {
  const lista = db
    .select()
    .from(fornecedores)
    .where(opcoes.somenteAtivos ? eq(fornecedores.ativo, true) : undefined)
    .orderBy(asc(fornecedores.nome))
    .all();
  const vinculos = db
    .select({
      fornecedorId: fornecedorCategorias.fornecedorId,
      categoriaId: categorias.id,
      categoria: categorias.nome,
    })
    .from(fornecedorCategorias)
    .innerJoin(categorias, eq(categorias.id, fornecedorCategorias.categoriaId))
    .all();
  return lista.map((f) => {
    const cats = vinculos.filter((v) => v.fornecedorId === f.id);
    return {
      ...f,
      categoriaIds: cats.map((c) => c.categoriaId),
      categorias: cats.map((c) => c.categoria),
    };
  });
}

export type FornecedorComCategorias = ReturnType<typeof listarFornecedores>[number];

export function fornecedoresPorCategoria(db: DB, categoriaIds: number[]) {
  if (!categoriaIds.length) return [];
  const ids = db
    .selectDistinct({ id: fornecedorCategorias.fornecedorId })
    .from(fornecedorCategorias)
    .where(inArray(fornecedorCategorias.categoriaId, categoriaIds))
    .all()
    .map((r) => r.id);
  return listarFornecedores(db, { somenteAtivos: true }).filter((f) => ids.includes(f.id));
}

export function salvarFornecedor(db: DB, entrada: FornecedorInput, id?: number) {
  const { categoriaIds, ...dados } = fornecedorSchema.parse(entrada);
  const valores = { ...dados, whatsapp: normalizarWhatsapp(dados.whatsapp) };
  return db.transaction((tx) => {
    if (valores.cnpj) {
      const dup = tx
        .select({ id: fornecedores.id, nome: fornecedores.nome })
        .from(fornecedores)
        .where(eq(fornecedores.cnpj, valores.cnpj))
        .get();
      if (dup && dup.id !== id) throw new Error(`CNPJ já cadastrado para ${dup.nome}`);
    }
    let fid = id;
    if (fid) tx.update(fornecedores).set(valores).where(eq(fornecedores.id, fid)).run();
    else fid = tx.insert(fornecedores).values(valores).returning({ id: fornecedores.id }).get().id;
    tx.delete(fornecedorCategorias).where(eq(fornecedorCategorias.fornecedorId, fid)).run();
    if (categoriaIds.length)
      tx.insert(fornecedorCategorias)
        .values(categoriaIds.map((categoriaId) => ({ fornecedorId: fid!, categoriaId })))
        .run();
    return fid;
  });
}

// ------------------------------------------------------------- materiais

export function listarMateriais(db: DB, opcoes: { somenteAtivos?: boolean } = {}) {
  const lista = db
    .select({
      id: materiais.id,
      nomePadronizado: materiais.nomePadronizado,
      unidade: materiais.unidade,
      categoriaId: materiais.categoriaId,
      categoria: categorias.nome,
      ativo: materiais.ativo,
      ultimoPreco: sql<number | null>`(select pi.preco_unitario_centavos from pedido_itens pi join pedidos p on p.id = pi.pedido_id where pi.material_id = materiais.id and p.status not in ('cancelado','aguardando_aprovacao') order by coalesce(p.data_emissao, p.criado_em) desc, p.id desc limit 1)`,
      compras: sql<number>`(select count(*) from pedido_itens pi join pedidos p on p.id = pi.pedido_id where pi.material_id = materiais.id and p.status not in ('cancelado','aguardando_aprovacao'))`,
    })
    .from(materiais)
    .innerJoin(categorias, eq(categorias.id, materiais.categoriaId))
    .where(opcoes.somenteAtivos ? eq(materiais.ativo, true) : undefined)
    .orderBy(asc(categorias.nome), asc(materiais.nomePadronizado))
    .all();
  const sins = db.select().from(materialSinonimos).all();
  return lista.map((m) => ({
    ...m,
    sinonimos: sins.filter((s) => s.materialId === m.id).map((s) => s.texto),
  }));
}

export type MaterialComSinonimos = ReturnType<typeof listarMateriais>[number];

export function catalogoParaBusca(db: DB): CandidatoMaterial[] {
  return listarMateriais(db, { somenteAtivos: true }).map((m) => ({
    id: m.id,
    nomePadronizado: m.nomePadronizado,
    unidade: m.unidade,
    sinonimos: m.sinonimos,
  }));
}

export function salvarMaterial(db: DB, entrada: MaterialInput, id?: number) {
  const { sinonimos, ...dados } = materialSchema.parse(entrada);
  return db.transaction((tx) => {
    const dup = tx
      .select({ id: materiais.id })
      .from(materiais)
      .where(sql`lower(${materiais.nomePadronizado}) = lower(${dados.nomePadronizado})`)
      .get();
    if (dup && dup.id !== id) throw new Error("Já existe um material com esse nome padronizado");

    let mid = id;
    if (mid) tx.update(materiais).set(dados).where(eq(materiais.id, mid)).run();
    else mid = tx.insert(materiais).values(dados).returning({ id: materiais.id }).get().id;

    tx.delete(materialSinonimos).where(eq(materialSinonimos.materialId, mid)).run();
    const vistos = new Set<string>([normalizarTexto(dados.nomePadronizado)]);
    for (const texto of sinonimos) {
      const norm = normalizarTexto(texto);
      if (!norm || vistos.has(norm)) continue;
      vistos.add(norm);
      const conflito = tx
        .select({ materialId: materialSinonimos.materialId })
        .from(materialSinonimos)
        .where(eq(materialSinonimos.textoNormalizado, norm))
        .get();
      if (conflito) throw new Error(`O sinônimo "${texto}" já pertence a outro material`);
      tx.insert(materialSinonimos).values({ materialId: mid, texto, textoNormalizado: norm }).run();
    }
    return mid;
  });
}

/** Adiciona um sinônimo a um material existente (usado pelas skills). */
export function adicionarSinonimo(db: DB, materialId: number, texto: string) {
  const norm = normalizarTexto(texto);
  if (!norm) return;
  const material = db.select().from(materiais).where(eq(materiais.id, materialId)).get();
  if (!material || normalizarTexto(material.nomePadronizado) === norm) return;
  const existe = db
    .select()
    .from(materialSinonimos)
    .where(eq(materialSinonimos.textoNormalizado, norm))
    .get();
  if (existe) return;
  db.insert(materialSinonimos).values({ materialId, texto: texto.trim(), textoNormalizado: norm }).run();
}

export function obterObraPorNome(db: DB, nome: string) {
  return db
    .select()
    .from(obras)
    .where(and(sql`lower(${obras.nome}) = lower(${nome.trim()})`))
    .get();
}
