// Requisição com materiais novos: usada pela tela "Colar pedido" e pela skill nova-requisicao.
// Valida tudo antes, cadastra os materiais novos (com o texto da obra como sinônimo) e grava.
import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { obras } from "@/db/schema";
import { diasEntre, hojeISO } from "@/lib/datas";
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
import { criarRequisicao } from "./requisicoes";

export type NovoMaterialEntrada = {
  nome: string;
  unidade: string;
  categoria: string;
  /** Permite criar a categoria se ela ainda não existir. */
  novaCategoria?: boolean;
  sinonimos?: string[];
};

export type ItemRequisicaoEntrada = {
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
      if (mesmoNome) throw new Error(`Item ${n}: já existe o material "${mesmoNome.nomePadronizado}". Escolha-o em vez de cadastrar de novo.`);
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

export function gravarRequisicao(db: DB, p: RequisicaoPreparada) {
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
    } else if (l.textoOriginal && materialId) {
      adicionarSinonimo(db, materialId, l.textoOriginal); // aprende o jeito da obra escrever
    }
    return { materialId: materialId!, quantidade: l.quantidade, especificacao: l.especificacao ?? null };
  });

  const id = criarRequisicao(db, {
    obraId: p.obra.id,
    solicitante: p.entrada.solicitante,
    dataPedido: p.dataPedido,
    dataNecessidade: p.entrada.dataNecessidade,
    urgente: p.urgente,
    origemTexto: p.entrada.origemTexto ?? null,
    observacoes: p.entrada.observacoes ?? null,
    itens,
  });
  return { id, novos, categoriasCriadas: [...categoriasCriadas.keys()] };
}
