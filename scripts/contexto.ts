/**
 * Consulta o banco (somente leitura) para as skills montarem rascunhos.
 *
 *   npm run ctx -- obras
 *   npm run ctx -- fornecedores [--categoria "Louças e metais"]
 *   npm run ctx -- materiais [--categoria Agregados]
 *   npm run ctx -- categorias
 *   npm run ctx -- requisicoes            (em andamento)
 *   npm run ctx -- requisicao 125         (itens, propostas e ids)
 *   npm run ctx -- buscar "cp2" "ferro 3/8" "vaso pcd"
 *   npm run ctx -- dia 2026-10-10 [2026-10-16]   (tudo o que aconteceu no dia/intervalo)
 */
import { getDb } from "../src/db/client";
import { hojeISO } from "../src/lib/datas";
import { atividadesNoPeriodo, resumirAtividades } from "../src/server/dados/atividades";
import { buscarMateriais } from "../src/lib/normalizar";
import {
  catalogoParaBusca,
  listarCategorias,
  listarFornecedores,
  listarMateriais,
  listarObras,
} from "../src/server/dados/cadastros";
import { listarPropostas, listarRequisicoes, obterRequisicao } from "../src/server/dados/requisicoes";
import { argumentos, falhar, rodar } from "./_comum";

const { posicionais, texto } = argumentos();
const [assunto, ...resto] = posicionais;
const db = getDb();
const saida = (x: unknown) => console.log(JSON.stringify(x, null, 2));

rodar(() => {
  switch (assunto) {
    case "dia": {
      const [de = hojeISO(), ate = de] = resto;
      const lista = atividadesNoPeriodo(db, de, ate);
      return saida({ de, ate, resumo: resumirAtividades(lista), atividades: lista });
    }
    case "obras":
      return saida(
        listarObras(db).map((o) => ({ id: o.id, nome: o.nome, status: o.status, endereco: o.endereco, cnpj: o.cnpj, cno: o.cno })),
      );
    case "categorias":
      return saida(listarCategorias(db));
    case "fornecedores": {
      const cat = texto("categoria")?.toLowerCase();
      return saida(
        listarFornecedores(db)
          .filter((f) => !cat || f.categorias.some((c) => c.toLowerCase().includes(cat)))
          .map((f) => ({ id: f.id, nome: f.nome, ativo: f.ativo, contato: f.contato, whatsapp: f.whatsapp, cnpj: f.cnpj, categorias: f.categorias })),
      );
    }
    case "materiais": {
      const cat = texto("categoria")?.toLowerCase();
      return saida(
        listarMateriais(db, { somenteAtivos: true })
          .filter((m) => !cat || m.categoria.toLowerCase().includes(cat))
          .map((m) => ({ id: m.id, nome: m.nomePadronizado, unidade: m.unidade, categoria: m.categoria, sinonimos: m.sinonimos, ultimoPreco: m.ultimoPreco })),
      );
    }
    case "buscar": {
      if (!resto.length) falhar('Informe o texto: npm run ctx -- buscar "cp2"');
      const cat = catalogoParaBusca(db);
      return saida(resto.map((t) => ({ texto: t, candidatos: buscarMateriais(t, cat, 3) })));
    }
    case "requisicoes":
      return saida(
        listarRequisicoes(db, { status: "em_andamento" }).map((r) => ({
          id: r.id,
          obra: r.obra,
          status: r.status,
          necessidade: r.dataNecessidade,
          urgente: r.urgente,
          itens: r.resumoItens,
          propostas: r.qtdPropostas,
        })),
      );
    case "requisicao": {
      const id = Number(resto[0]);
      const r = obterRequisicao(db, id);
      if (!r) falhar(`Requisição ${resto[0]} não encontrada`);
      return saida({
        id: r.id,
        obra: r.obra,
        status: r.status,
        dataNecessidade: r.dataNecessidade,
        urgente: r.urgente,
        itens: r.itens.map((i) => ({ requisicaoItemId: i.id, materialId: i.materialId, material: i.material, quantidade: i.quantidade, unidade: i.unidade, especificacao: i.especificacao })),
        propostas: listarPropostas(db, id).map((p) => ({ id: p.id, fornecedorId: p.fornecedorId, fornecedor: p.fornecedor, itensCotados: p.itens.length })),
      });
    }
    default:
      falhar("Use: obras | fornecedores | materiais | categorias | requisicoes | requisicao <id> | buscar <texto…>");
  }
});
