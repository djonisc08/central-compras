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
import { getDb } from "../src/db/client";
import { formatarData, hojeISO } from "../src/lib/datas";
import {
  gravarRequisicao,
  prepararRequisicao,
  type RequisicaoCompletaEntrada,
} from "../src/server/dados/requisicao-completa";
import { argumentos, avisar, falhar, lerJson, moverParaProcessados, rodapePrevia, rodar, tabela, URL_APP } from "./_comum";

type Rascunho = RequisicaoCompletaEntrada & { arquivoOrigem?: string };

const { texto, tem } = argumentos();
const arquivo = texto("arquivo") ?? falhar("Informe --arquivo entrada/rascunhos/<nome>.json");
const confirmar = tem("confirmar");

rodar(() => {
  const db = getDb();
  const r = lerJson<Rascunho>(arquivo);
  const p = prepararRequisicao(db, r);

  console.log(`\nRequisição para ${p.obra.nome}`);
  console.log(`Solicitante: ${r.solicitante} · Pedido: ${formatarData(p.dataPedido)} · Precisa até: ${formatarData(r.dataNecessidade)}${p.urgente ? " · URGENTE" : ""}\n`);
  tabela(
    ["#", "Material", "Qtd.", "Un.", "Como veio", "Especificação"],
    p.linhas.map((l) => [
      l.n,
      l.novo ? `${l.nome} (NOVO · ${l.categoria})` : l.nome,
      l.quantidade.toLocaleString("pt-BR"),
      l.unidade,
      l.textoOriginal ?? "",
      l.especificacao ?? "",
    ]),
  );
  avisar(p.avisos);

  if (!confirmar) return rodapePrevia(`npm run gravar:requisicao -- --arquivo ${arquivo}`);

  const { id, novos } = gravarRequisicao(db, p);
  for (const m of novos) console.log(`+ Material cadastrado: ${m.nome} (id ${m.id})`);
  const movido = moverParaProcessados(r.arquivoOrigem, hojeISO());
  console.log(`\n✓ Requisição #${id} gravada.${movido ? ` Arquivo movido para ${movido}.` : ""}`);
  console.log(`  Abrir: ${URL_APP}/requisicoes/${id}\n`);
});
