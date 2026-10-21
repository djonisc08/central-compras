// Requisição com materiais novos: usada pela tela "Colar pedido" e pela skill nova-requisicao.
// Valida tudo antes, cadastra os materiais novos (com o texto da obra como sinônimo) e grava.
import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { materiais, obras, propostaItens, requisicaoItens, requisicoes } from "@/db/schema";
import { diasEntre, hojeISO } from "@/lib/datas";
import { requisicaoSchema } from "@/lib/validacao";
import { buscarMateriais, normalizarTexto } from "@/lib/normalizar";
import {
  adicionarSinonimo,
  catalogoParaBusca,
  criarCategoria,
  listarCategorias,
  listarMateriais,
  obterObraPorNome,
  salvarMaterial,
} from "./cadastros";
import { criarRequisicao, recalcularStatusRequisicao, soltarDePedidosCancelados, temPedidosAtivos } from "./requisicoes";

export type NovoMaterialEntrada = {
  nome: string;
  unidade: string;
  categoria: string;
  /** Permite criar a categoria se ela ainda não existir. */
  novaCategoria?: boolean;
  sinonimos?: string[];
};

export type ItemRequisicaoEntrada = {
  /** Item já existente na requisição (edição). */
  id?: number | null;
  materialId?: number | null;
  novoMaterial?: NovoMaterialEntrada | null;
  quantidade: number;
  especificacao?: string | null;
  textoOriginal?: string | null;
};

export type RequisicaoCompletaEntrada = {
  obra: string | number;
  solicitante: string;
  dataPedido?: string;
  dataNecessidade: string;
  urgente?: boolean;
  origemTexto?: string | null;
  observacoes?: string | null;
  itens: ItemRequisicaoEntrada[];
};

export function prepararRequisicao(db: DB, r: RequisicaoCompletaEntrada) {
  const avisos: string[] = [];
  const hoje = hojeISO();

  const obra =
    typeof r.obra === "number" ? db.select().from(obras).where(eq(obras.id, r.obra)).get() : obterObraPorNome(db, String(r.obra ?? ""));
  if (!obra) throw new Error(`Obra "${r.obra}" não encontrada. Obras: ${db.select({ nome: obras.nome }).from(obras).all().map((o) => o.nome).join(", ")}`);

  const dataPedido = r.dataPedido || hoje;
  if (!r.dataNecessidade) throw new Error("Informe a data de necessidade");
  const prazo = diasEntre(dataPedido, r.dataNecessidade);
  const urgente = r.urgente ?? prazo <= 1;
  if (r.urgente === undefined && urgente) avisos.push(`Marcada como URGENTE automaticamente (precisa em ${prazo} dia(s)).`);
  if (r.dataNecessidade < hoje) avisos.push("Data de necessidade já passou — confira.");

  const materiais = new Map(listarMateriais(db).map((m) => [m.id, m]));
  const categorias = listarCategorias(db);
  const catalogo = catalogoParaBusca(db);
  if (!r.itens?.length) throw new Error("Inclua pelo menos um item");

  const linhas = r.itens.map((i, idx) => {
    const n = idx + 1;
    if (!(i.quantidade > 0)) throw new Error(`Item ${n}: quantidade inválida`);
    if (i.materialId) {
      const m = materiais.get(i.materialId);
      if (!m) throw new Error(`Item ${n}: material id ${i.materialId} não existe`);
      if (i.textoOriginal) {
        const match = buscarMateriais(i.textoOriginal, catalogo, 1)[0];
        if (!match || match.id !== m.id) avisos.push(`Item ${n}: "${i.textoOriginal}" não parece com "${m.nomePadronizado}". Confirme.`);
      }
      return { n, ...i, nome: m.nomePadronizado, unidade: m.unidade, novo: false as const, categoriaId: m.categoriaId };
    }
    const nm = i.novoMaterial;
    if (nm) {
      if (nm.nome.trim().length < 3) throw new Error(`Item ${n}: informe o nome padronizado do material novo`);
      if (!nm.unidade.trim()) throw new Error(`Item ${n}: informe a unidade do material novo`);
      const existente = categorias.find((c) => normalizarTexto(c.nome) === normalizarTexto(nm.categoria));
      if (!existente && !nm.novaCategoria)
        throw new Error(`Item ${n}: categoria "${nm.categoria}" não existe. Use uma de: ${categorias.map((c) => c.nome).join(", ")}`);
      if (!existente) avisos.push(`Categoria NOVA será criada: "${nm.categoria}". Marque os fornecedores que atendem essa categoria.`);
      const mesmoNome = [...materiais.values()].find((m) => normalizarTexto(m.nomePadronizado) === normalizarTexto(nm.nome));
      if (mesmoNome) {
        // Já está no catálogo (às vezes inativo ou criado numa tentativa anterior): usa o existente.
        avisos.push(`Item ${n}: "${mesmoNome.nomePadronizado}" já estava no catálogo — usei o cadastro existente.`);
        return {
          n,
          ...i,
          materialId: mesmoNome.id,
          novoMaterial: null,
          reativar: !mesmoNome.ativo,
          nome: mesmoNome.nomePadronizado,
          unidade: mesmoNome.unidade,
          novo: false as const,
          categoriaId: mesmoNome.categoriaId,
        };
      }
      const parecido = buscarMateriais(nm.nome, catalogo, 1)[0];
      if (parecido && parecido.pontuacao >= 0.6)
        avisos.push(`Item ${n}: material novo "${nm.nome}" é parecido com o existente "${parecido.nomePadronizado}". É o mesmo?`);
      return { n, ...i, nome: nm.nome, unidade: nm.unidade, novo: true as const, categoriaId: existente?.id ?? 0, categoria: existente?.nome ?? nm.categoria };
    }
    throw new Error(`Item ${n}: escolha um material do catálogo ou cadastre um novo`);
  });

  return { obra, dataPedido, urgente, linhas, avisos, entrada: r };
}

export type RequisicaoPreparada = ReturnType<typeof prepararRequisicao>;

const semId = <T extends { id: unknown }>({ id, ...resto }: T) => (void id, resto);

/** Cadastra os materiais novos (e categorias) e devolve os itens prontos para gravar. */
function resolverItens(db: DB, p: RequisicaoPreparada) {
  const novos: { id: number; nome: string }[] = [];
  const categoriasCriadas = new Map<string, number>();
  const itens = p.linhas.map((l) => {
    let materialId = l.materialId ?? undefined;
    if (l.novo && l.novoMaterial) {
      const chave = normalizarTexto(l.novoMaterial.categoria);
      let categoriaId = l.categoriaId || categoriasCriadas.get(chave);
      if (!categoriaId) {
        categoriaId = criarCategoria(db, l.novoMaterial.categoria);
        categoriasCriadas.set(chave, categoriaId);
      }
      materialId = salvarMaterial(db, {
        nomePadronizado: l.novoMaterial.nome.trim(),
        unidade: l.novoMaterial.unidade.trim(),
        categoriaId,
        sinonimos: [...(l.novoMaterial.sinonimos ?? []), ...(l.textoOriginal ? [l.textoOriginal] : [])],
      });
      novos.push({ id: materialId, nome: l.novoMaterial.nome });
    } else if ("reativar" in l && l.reativar && materialId) {
      db.update(materiais).set({ ativo: true }).where(eq(materiais.id, materialId)).run();
      if (l.textoOriginal) adicionarSinonimo(db, materialId, l.textoOriginal);
    } else if (l.textoOriginal && materialId) {
      adicionarSinonimo(db, materialId, l.textoOriginal); // aprende o jeito da obra escrever
    }
    return { id: l.id ?? null, materialId: materialId!, quantidade: l.quantidade, especificacao: l.especificacao || null };
  });
  return { itens, novos, categoriasCriadas: [...categoriasCriadas.keys()] };
}

export function gravarRequisicao(db: DB, p: RequisicaoPreparada) {
  // Tudo ou nada: se a requisição falhar, os materiais novos também não ficam no catálogo.
  return db.transaction((tx) => gravarRequisicaoEm(tx as unknown as DB, p));
}

function gravarRequisicaoEm(db: DB, p: RequisicaoPreparada) {
  const { itens, novos, categoriasCriadas } = resolverItens(db, p);
  const id = criarRequisicao(db, {
    obraId: p.obra.id,
    solicitante: p.entrada.solicitante,
    dataPedido: p.dataPedido,
    dataNecessidade: p.entrada.dataNecessidade,
    urgente: p.urgente,
    origemTexto: p.entrada.origemTexto ?? null,
    observacoes: p.entrada.observacoes ?? null,
    itens: itens.map(semId),
  });
  return { id, novos, categoriasCriadas };
}

/**
 * Edita uma requisição antes dos pedidos: cabeçalho, itens alterados, removidos e novos.
 * Item que mudou de material perde os preços já lançados para ele (são de outro produto).
 */
export function atualizarRequisicaoCompleta(db: DB, requisicaoId: number, p: RequisicaoPreparada) {
  const req = db.select().from(requisicoes).where(eq(requisicoes.id, requisicaoId)).get();
  if (!req) throw new Error("Requisição não encontrada");
  if (["cancelada", "entregue"].includes(req.status) || temPedidosAtivos(db, requisicaoId))
    throw new Error("Esta requisição já tem pedidos. Cancele os pedidos para alterar os itens.");

  return db.transaction((tx) => {
    const { itens, novos, categoriasCriadas } = resolverItens(tx as unknown as DB, p);
    const atuais = new Map(
      tx.select().from(requisicaoItens).where(eq(requisicaoItens.requisicaoId, requisicaoId)).all().map((i) => [i.id, i]),
    );
    const mantidos = new Set<number>();
    for (const i of itens) {
      const atual = i.id ? atuais.get(i.id) : undefined;
      if (atual && atual.materialId === i.materialId) {
        mantidos.add(atual.id);
        tx.update(requisicaoItens).set({ quantidade: i.quantidade, especificacao: i.especificacao }).where(eq(requisicaoItens.id, atual.id)).run();
        // Quantidade mudou: o total exato que o fornecedor deu era para a quantidade antiga. Vale preço × nova quantidade.
        if (atual.quantidade !== i.quantidade)
          tx.update(propostaItens)
            .set({ totalCentavos: null, quantidadeCotada: null, unidadeCotada: null })
            .where(eq(propostaItens.requisicaoItemId, atual.id))
            .run();
      } else {
        tx.insert(requisicaoItens).values({ requisicaoId, materialId: i.materialId, quantidade: i.quantidade, especificacao: i.especificacao }).run();
      }
    }
    // Mesma validação da criação (src/lib/validacao.ts).
    const cab = requisicaoSchema.parse({
      obraId: p.obra.id,
      solicitante: p.entrada.solicitante,
      dataPedido: p.dataPedido,
      dataNecessidade: p.entrada.dataNecessidade,
      urgente: p.urgente,
      origemTexto: p.entrada.origemTexto,
      observacoes: p.entrada.observacoes,
      itens: itens.map(semId),
    });
    const removidos = [...atuais.keys()].filter((id) => !mantidos.has(id));
    soltarDePedidosCancelados(tx as unknown as DB, { requisicaoItemIds: removidos });
    for (const id of removidos) tx.delete(requisicaoItens).where(eq(requisicaoItens.id, id)).run();

    tx.update(requisicoes)
      .set({
        obraId: cab.obraId,
        solicitante: cab.solicitante,
        dataPedido: cab.dataPedido,
        dataNecessidade: cab.dataNecessidade,
        urgente: cab.urgente,
        origemTexto: cab.origemTexto,
        observacoes: cab.observacoes,
      })
      .where(eq(requisicoes.id, requisicaoId))
      .run();
    recalcularStatusRequisicao(tx as unknown as DB, requisicaoId);
    return { id: requisicaoId, novos, categoriasCriadas, removidos: removidos.length };
  });
}
