/**
 * Grava uma requisição a partir de um rascunho JSON (skill nova-requisicao).
 *
 *   npm run gravar:requisicao -- --arquivo entrada/rascunhos/req-xxx.json             → prévia
 *   npm run gravar:requisicao -- --arquivo entrada/rascunhos/req-xxx.json --confirmar → grava
 *
 * Formato do rascunho:
 * {
 *   "obra": "MAX Studio 206",            // nome ou id
 *   "solicitante": "Mestre de obras",
 *   "dataPedido": "2026-10-20",          // opcional (hoje)
 *   "dataNecessidade": "2026-10-22",
 *   "urgente": true,                     // opcional (automático se precisa em até 1 dia)
 *   "origemTexto": "texto do WhatsApp",
 *   "arquivoOrigem": "entrada/whats.txt",// opcional: movido para entrada/processados ao gravar
 *   "observacoes": "...",
 *   "itens": [
 *     { "materialId": 1, "quantidade": 100, "textoOriginal": "cp2", "especificacao": "..." },
 *     { "novoMaterial": { "nome": "Telha fibrocimento 2,44x1,10m 6mm", "unidade": "un", "categoria": "Cobertura", "novaCategoria": true },
 *       "quantidade": 40, "textoOriginal": "telha brasilit 6mm" }
 *   ]
 * }
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { obras } from "../src/db/schema";
import { diasEntre, formatarData, hojeISO } from "../src/lib/datas";
import { buscarMateriais, normalizarTexto } from "../src/lib/normalizar";
import {
  adicionarSinonimo,
  catalogoParaBusca,
  criarCategoria,
  listarCategorias,
  listarMateriais,
  obterObraPorNome,
  salvarMaterial,
} from "../src/server/dados/cadastros";
import { criarRequisicao } from "../src/server/dados/requisicoes";
import { argumentos, avisar, falhar, lerJson, moverParaProcessados, rodapePrevia, rodar, tabela, URL_APP } from "./_comum";

type Rascunho = {
  obra: string | number;
  solicitante: string;
  dataPedido?: string;
  dataNecessidade: string;
  urgente?: boolean;
  origemTexto?: string;
  arquivoOrigem?: string;
  observacoes?: string;
  itens: {
    materialId?: number;
    novoMaterial?: { nome: string; unidade: string; categoria: string; novaCategoria?: boolean; sinonimos?: string[] };
    quantidade: number;
    especificacao?: string;
    textoOriginal?: string;
  }[];
};

const { texto, tem } = argumentos();
const arquivo = texto("arquivo") ?? falhar("Informe --arquivo entrada/rascunhos/<nome>.json");
const confirmar = tem("confirmar");

rodar(() => {
  const db = getDb();
  const r = lerJson<Rascunho>(arquivo);
  const hoje = hojeISO();
  const avisos: string[] = [];

  const obra =
    typeof r.obra === "number" ? db.select().from(obras).where(eq(obras.id, r.obra)).get() : obterObraPorNome(db, String(r.obra ?? ""));
  if (!obra) falhar(`Obra "${r.obra}" não encontrada. Obras: ${db.select({ nome: obras.nome }).from(obras).all().map((o) => o.nome).join(", ")}`);

  const dataPedido = r.dataPedido ?? hoje;
  if (!r.dataNecessidade) falhar("Informe dataNecessidade (AAAA-MM-DD)");
  const prazo = diasEntre(dataPedido, r.dataNecessidade);
  const urgente = r.urgente ?? prazo <= 1;
  if (r.urgente === undefined && urgente) avisos.push(`Marcada como URGENTE automaticamente (precisa em ${prazo} dia(s)).`);
  if (r.dataNecessidade < hoje) avisos.push("Data de necessidade já passou — confira.");

  const materiais = new Map(listarMateriais(db).map((m) => [m.id, m]));
  const categorias = listarCategorias(db);
  const catalogo = catalogoParaBusca(db);
  if (!r.itens?.length) falhar("Rascunho sem itens");

  const linhas = r.itens.map((i, n) => {
    if (!(i.quantidade > 0)) falhar(`Item ${n + 1}: quantidade inválida`);
    if (i.materialId) {
      const m = materiais.get(i.materialId) ?? falhar(`Item ${n + 1}: material id ${i.materialId} não existe`);
      if (i.textoOriginal) {
        const match = buscarMateriais(i.textoOriginal, catalogo, 1)[0];
        if (!match || match.id !== m.id) avisos.push(`Item ${n + 1}: "${i.textoOriginal}" não parece com "${m.nomePadronizado}". Confirme.`);
      }
      return { n: n + 1, ...i, nome: m.nomePadronizado, unidade: m.unidade, novo: false };
    }
    if (i.novoMaterial) {
      const existente = categorias.find((c) => normalizarTexto(c.nome) === normalizarTexto(i.novoMaterial!.categoria));
      if (!existente && !i.novoMaterial.novaCategoria)
        falhar(`Item ${n + 1}: categoria "${i.novoMaterial.categoria}" não existe. Use uma de: ${categorias.map((c) => c.nome).join(", ")} — ou "novaCategoria": true para criar.`);
      if (!existente) avisos.push(`Categoria NOVA será criada: "${i.novoMaterial.categoria}". Lembre de marcar os fornecedores que atendem essa categoria.`);
      const cat = existente ?? { id: 0, nome: `${i.novoMaterial.categoria} (nova)` };
      const parecido = buscarMateriais(i.novoMaterial.nome, catalogo, 1)[0];
      if (parecido && parecido.pontuacao >= 0.6)
        avisos.push(`Item ${n + 1}: material novo "${i.novoMaterial.nome}" é parecido com o existente "${parecido.nomePadronizado}" (id ${parecido.id}).`);
      return { n: n + 1, ...i, nome: `${i.novoMaterial.nome} (NOVO · ${cat.nome})`, unidade: i.novoMaterial.unidade, novo: true, categoriaId: cat.id };
    }
    falhar(`Item ${n + 1}: informe materialId ou novoMaterial`);
  });

  console.log(`\nRequisição para ${obra.nome}`);
  console.log(`Solicitante: ${r.solicitante} · Pedido: ${formatarData(dataPedido)} · Precisa até: ${formatarData(r.dataNecessidade)}${urgente ? " · URGENTE" : ""}\n`);
  tabela(
    ["#", "Material", "Qtd.", "Un.", "Como veio", "Especificação"],
    linhas.map((l) => [l.n, l.nome, l.quantidade.toLocaleString("pt-BR"), l.unidade, l.textoOriginal ?? "", l.especificacao ?? ""]),
  );
  avisar(avisos);

  if (!confirmar) return rodapePrevia(`npm run gravar:requisicao -- --arquivo ${arquivo}`);

  const itens = linhas.map((l) => {
    let materialId = l.materialId;
    if (l.novo && l.novoMaterial) {
      const categoriaId = (l as { categoriaId: number }).categoriaId || criarCategoria(db, l.novoMaterial.categoria);
      materialId = salvarMaterial(db, {
        nomePadronizado: l.novoMaterial.nome,
        unidade: l.novoMaterial.unidade,
        categoriaId,
        sinonimos: [...(l.novoMaterial.sinonimos ?? []), ...(l.textoOriginal ? [l.textoOriginal] : [])],
      });
      console.log(`+ Material cadastrado: ${l.novoMaterial.nome} (id ${materialId})`);
    } else if (l.textoOriginal && materialId) {
      adicionarSinonimo(db, materialId, l.textoOriginal); // aprende o jeito da obra escrever
    }
    return { materialId: materialId!, quantidade: l.quantidade, especificacao: l.especificacao ?? null };
  });

  const id = criarRequisicao(db, {
    obraId: obra.id,
    solicitante: r.solicitante,
    dataPedido,
    dataNecessidade: r.dataNecessidade,
    urgente,
    origemTexto: r.origemTexto ?? null,
    observacoes: r.observacoes ?? null,
    itens,
  });
  const movido = moverParaProcessados(r.arquivoOrigem, hoje);
  console.log(`\n✓ Requisição #${id} gravada.${movido ? ` Arquivo movido para ${movido}.` : ""}`);
  console.log(`  Abrir: ${URL_APP}/requisicoes/${id}\n`);
});
