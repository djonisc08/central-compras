// Interpreta pedidos colados do WhatsApp (texto livre) sem IA: obra, CNPJ/CNO, prazo, itens,
// quantidades e unidades, casando com o catálogo. Puro e testável; roda no navegador e no servidor.
import { deISO, paraISO, somarDias } from "./datas";
import { buscarMateriais, normalizarTexto, somenteDigitos, type CandidatoMaterial } from "./normalizar";

export type ObraContexto = { id: number; nome: string; cnpj: string | null; cno: string | null; endereco: string | null };

export type ItemInterpretado = {
  linha: string;
  textoOriginal: string;
  quantidade: number;
  /** Unidade escrita na mensagem (já padronizada), se houver. */
  unidadeInformada: string | null;
  /** catalogo = casou com segurança · confirmar = parecido, conferir · novo = não existe no catálogo */
  situacao: "catalogo" | "confirmar" | "novo";
  materialId: number | null;
  candidatos: { id: number; nomePadronizado: string; unidade: string; pontuacao: number }[];
  sugestaoNovo: { nome: string; unidade: string; categoria: string };
  aviso: string | null;
};

export type PedidoInterpretado = {
  obraId: number | null;
  obraMotivo: string | null;
  solicitante: string | null;
  dataPedido: string;
  dataNecessidade: string | null;
  necessidadeMotivo: string | null;
  urgente: boolean;
  cnpjs: string[];
  cno: string | null;
  alertas: string[];
  observacoes: string[];
  itens: ItemInterpretado[];
  linhasIgnoradas: string[];
};

// ------------------------------------------------------------------ unidades

const UNIDADES: [RegExp, string, number][] = [
  [/^(milheiros?|mil)$/, "un", 1000],
  [/^(kg|kgs|quilos?|kilos?)$/, "kg", 1],
  [/^(sc|scs|sacos?)$/, "sc", 1],
  [/^(m3|m³|mts3|metros? cubicos?)$/, "m³", 1],
  [/^(m2|m²|metros? quadrados?)$/, "m²", 1],
  [/^(br|brs|barras?)$/, "br", 1],
  [/^(rl|rls|rolos?)$/, "rl", 1],
  [/^(pc|pcs|pç|pçs|pecas?|peças?)$/, "pc", 1],
  [/^(un|und|unds|unid|unids|unidades?)$/, "un", 1],
  [/^(cx|cxs|caixas?)$/, "cx", 1],
  [/^(lt|lts|latas?)$/, "lt", 1],
  [/^(gl|galao|galão|galoes|galões)$/, "gl", 1],
  [/^(l|litros?)$/, "l", 1],
  [/^(t|ton|tons|toneladas?)$/, "t", 1],
  [/^(pct|pcts|pacotes?)$/, "pct", 1],
  [/^(par|pares)$/, "par", 1],
  [/^(bd|baldes?)$/, "bd", 1],
  [/^(cj|cjs|conjuntos?|jogos?|kit|kits)$/, "cj", 1],
  [/^(m|mt|mts|ml|metros?)$/, "m", 1],
];

function lerUnidade(token: string): { unidade: string; fator: number } | null {
  const t = token.toLowerCase().replace(/\.$/, "");
  for (const [re, unidade, fator] of UNIDADES) if (re.test(t)) return { unidade, fator };
  return null;
}

// ------------------------------------------------------------ categorias

const CATEGORIAS: [string, RegExp][] = [
  ["Produtos de limpeza", /\b(detergente|desinfetante|agua sanitaria|cloro|sabao|sabonete|alcool (em gel|70)|limpa ?vidro|multiuso|desengordurante|vassoura|rodo|pano de chao|flanela|esponja|balde|saco de lixo|sacos de lixo|papel higienico|papel toalha|limpa porcelanato|acido muriatico|removedor|lustra moveis|cera)\b/],
  ["Refrigeração", /\b(cobre|isolante|isolamento|esponjoso|armaflex|blindado|tectape|tape|split|evaporadora|condensadora|ar condicionado|r ?410a?|r ?32|gas refrigerante|fita pvc|pvc pret[ao]|dreno|suporte (de )?condensadora|flangeador)\b/],
  ["Louças e metais", /\b(vaso|bacia|cuba|torneira|chuveiro|louca|assento sanitario|mictorio|lavatorio)\b/],
  ["Blocos e tijolos", /\b(bloco|blocos|tijolo|tijolos|siporex|canaleta|celular)\b/],
  ["Elétrica", /\b(fio|fios|cabo|cabos|eletroduto|conduite|perfilado|eletrocalha|disjuntor|tomada|interruptor|quadro de distribuicao|lampada|luminaria|plafon|caixa 4x2)\b/],
  ["Fixação", /\b(parafuso|parafusos|porca|porcas|arruela|arruelas|chumbador|chumbadores|parabolt|bucha|buchas|barra roscada|rebite|cone|prisioneiro|abracadeira)\b/],
  ["Hidráulica", /\b(tubo|tubos|cano|canos|joelho|joelhos|registro|conexao|pvc|soldavel|esgoto|ralo|sifao|caixa d agua|luva pvc|te pvc)\b/],
  ["Cobertura", /\b(telha|telhas|cumeeira|rufo|calha|fibrocimento)\b/],
  ["Impermeabilização", /\b(manta|impermeabilizante|vedacit|sika|emulsao|asfaltica)\b/],
  ["Cimento e argamassa", /\b(cimento|argamassa|cal|rejunte|graute|cp2|cpii|cp5|cpv|ac2|ac3)\b/],
  ["Agregados", /\b(areia|brita|pedrisco|po de pedra|saibro|rachao)\b/],
  ["Madeiras", /\b(tabua|sarrafo|compensado|madeirite|pontalete|caibro|ripa|viga de madeira|prego|pregos)\b/],
  ["Aço e ferragens", /\b(vergalhao|ferro|ca 50|ca50|ca 60|ca60|arame|tela|espacador|espacadores|grampo|estribo|trelica)\b/],
  ["EPI e ferramentas", /\b(capacete|bota|botina|oculos|mascara|protetor|cinto|luva de|luvas|disco|broca|trena|carrinho de mao)\b/],
];

export function adivinharCategoria(texto: string): string {
  const t = normalizarTexto(texto);
  for (const [nome, re] of CATEGORIAS) if (re.test(t)) return nome;
  return "";
}

// --------------------------------------------------------------- utilidades

const PREFIXO_WHATS = [
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}:\d{2})(?::\d{2})?\]\s*([^:]{1,40}):\s*(.*)$/, // iPhone/desktop
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}:\d{2})\s*-\s*([^:]{1,40}):\s*(.*)$/, // Android
];

function iso(d: string, m: string, a: string) {
  const ano = a.length === 2 ? `20${a}` : a;
  return `${ano}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const LINHA_CABECALHO =
  /\b(cnpj|cno|e-?mail|contato|endereco|entrega|rua|r\.|av\.|avenida|rodovia|bairro|cep|ltda|eireli|incorporac|financeiro|telefone|fone|whats|vou precisar|segue|seguem|obrigad|bom dia|boa tarde|boa noite|ola|oi\b|para obra|obra:)/;

function ehLinhaDeCabecalho(norm: string) {
  if (LINHA_CABECALHO.test(norm)) return true;
  if (/\b\d{2}\s?9?\d{4}[- ]?\d{4}\b/.test(norm) && !/\d+\s?(mm|cm|m|kg)\b/.test(norm)) return true; // telefone
  return false;
}

/** "07x30x60cm" → mantém; "8MM" → "8mm"; primeira letra maiúscula. */
export function padronizarNome(texto: string) {
  let t = texto
    .replace(/\s+/g, " ")
    .replace(/^\s*(de|do|da)\s+/i, "")
    .replace(/(\d)\s*(MM|CM|M|KG|L)\b/g, (_, n, u: string) => `${n}${u.toLowerCase()}`)
    .replace(/\s*-\s*$/, "")
    .trim();
  // Remove o plural mais comum no começo ("blocos de" → "Bloco de", "telhas" → "Telha").
  t = t.replace(/^(\p{L}+?)s\b/iu, "$1");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function numerosDe(texto: string) {
  return (normalizarTexto(texto).match(/\d+(?:[.,/]\d+)?/g) ?? []).map((n) => n.replace(",", "."));
}

/** "⅝" → "5/8": a obra escreve bitola com o símbolo de fração. */
const FRACOES: Record<string, string> = { "½": "1/2", "¼": "1/4", "¾": "3/4", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8", "⅓": "1/3", "⅔": "2/3" };

const DIAS_SEMANA: Record<string, number> = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

function interpretarNecessidade(texto: string, dataPedido: string): { data: string; motivo: string; urgente: boolean } | null {
  const t = normalizarTexto(texto);
  if (/\b(imediat\w*|urgente|urgencia|agora|hoje|ainda hoje|o quanto antes|asap)\b/.test(t))
    return { data: dataPedido, motivo: t.match(/\b(imediat\w*|urgente|urgencia|agora|hoje|ainda hoje|o quanto antes|asap)\b/)![0], urgente: true };
  if (/\bamanha\b/.test(t)) return { data: somarDias(dataPedido, 1), motivo: "amanhã", urgente: true };
  const dm = t.match(/\b(?:dia|ate|para|pra|p\/|entrega|em)\s*(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (dm) {
    const ano = dm[3] ?? dataPedido.slice(0, 4);
    let d = iso(dm[1], dm[2], ano);
    if (!dm[3] && d < dataPedido) d = iso(dm[1], dm[2], String(Number(ano) + 1));
    return { data: d, motivo: `dia ${dm[1]}/${dm[2]}`, urgente: false };
  }
  const ds = t.match(/\b(?:pra|para|ate|na|no)\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo)\b/);
  if (ds) {
    const alvo = DIAS_SEMANA[ds[1]];
    const base = deISO(dataPedido);
    let dif = (alvo - base.getDay() + 7) % 7;
    if (dif === 0) dif = 7;
    base.setDate(base.getDate() + dif);
    return { data: paraISO(base), motivo: ds[1], urgente: dif <= 1 };
  }
  return null;
}

// ------------------------------------------------------------- principal

export function interpretarPedido(
  textoBruto: string,
  ctx: { obras: ObraContexto[]; catalogo: (CandidatoMaterial & { categoria?: string })[] },
  hoje: string,
): PedidoInterpretado {
  const alertas: string[] = [];
  const observacoes: string[] = [];
  const linhasIgnoradas: string[] = [];
  let solicitante: string | null = null;
  let dataPedido: string | null = null;

  // 1. Remove o prefixo do WhatsApp e separa as linhas.
  const linhas: string[] = [];
  for (const bruta of textoBruto.replace(/\r/g, "").split("\n")) {
    let l = bruta
      .replace(/[‎‏‪-‮]/g, "")
      .replace(/\s*([½¼¾⅛⅜⅝⅞⅓⅔])/g, (_, f: string) => ` ${FRACOES[f]}`)
      .trim();
    for (const re of PREFIXO_WHATS) {
      const m = l.match(re);
      if (m) {
        dataPedido ??= iso(m[1], m[2], m[3]);
        solicitante ??= m[5].trim();
        l = m[6].trim();
        break;
      }
    }
    if (l) linhas.push(l);
  }
  const texto = linhas.join("\n");
  const norm = normalizarTexto(texto);
  dataPedido ??= hoje;

  // 2. Obra: nome, número ("189"), CNO ou endereço.
  let obraId: number | null = null;
  let obraMotivo: string | null = null;
  for (const o of ctx.obras) {
    if (norm.includes(normalizarTexto(o.nome))) {
      obraId = o.id;
      obraMotivo = `nome "${o.nome}"`;
      break;
    }
  }
  if (!obraId) {
    const cnoMsg = somenteDigitos(texto.match(/cno[:\s]*([\d./-]{10,})/i)?.[1]);
    const porCno = cnoMsg ? ctx.obras.find((o) => o.cno && somenteDigitos(o.cno) === cnoMsg) : undefined;
    if (porCno) {
      obraId = porCno.id;
      obraMotivo = `CNO ${porCno.cno}`;
    }
  }
  if (!obraId) {
    const candidatas = ctx.obras.filter((o) => {
      const num = o.nome.match(/\d{2,4}/)?.[0];
      return num && new RegExp(`\\b(obra|max|studio|studios|st)\\s*${num}\\b`).test(norm);
    });
    if (candidatas.length === 1) {
      obraId = candidatas[0].id;
      obraMotivo = `número da obra`;
    }
  }
  if (!obraId) {
    const porEndereco = ctx.obras.find((o) => {
      const rua = o.endereco?.split(/[–,-]/)[0];
      return rua && rua.length > 8 && norm.includes(normalizarTexto(rua));
    });
    if (porEndereco) {
      obraId = porEndereco.id;
      obraMotivo = "endereço de entrega";
    }
  }
  if (!obraId) alertas.push("Não identifiquei a obra na mensagem. Escolha a obra.");

  // 3. CNPJ e CNO: conferir com a ficha cadastral da obra.
  const cnpjs = [...new Set((texto.match(/\b\d{2}\.?\d{3}\.?\d{3}[./]?\d{4}-?\d{2}\b/g) ?? []).map(somenteDigitos))];
  const cno = texto.match(/cno[:\s]*([\d./-]{10,})/i)?.[1]?.trim() ?? null;
  const obra = ctx.obras.find((o) => o.id === obraId);
  if (obra) {
    for (const c of cnpjs)
      if (obra.cnpj && c !== obra.cnpj)
        alertas.push(
          `A mensagem traz o CNPJ ${c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}, diferente do CNPJ da ficha da ${obra.nome} (${obra.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}). Confirme com quem pediu antes de cotar — a NF sai com o CNPJ da ficha.`,
        );
    if (cno && obra.cno && somenteDigitos(cno) !== somenteDigitos(obra.cno))
      alertas.push(`O CNO da mensagem (${cno}) é diferente do CNO da ficha da ${obra.nome} (${obra.cno}).`);
  }

  // 4. Prazo.
  const nec = interpretarNecessidade(texto, dataPedido);
  if (!nec) alertas.push("A mensagem não diz quando precisa. Informe a data de necessidade.");

  // 5. Itens.
  const itens: ItemInterpretado[] = [];
  const RE_ITEM = /^[\s\-–—•*·>]*(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)\s*(?:[-–—x×)]\s*)?(.*\p{L}.*)$/u;
  const RE_UNIDADE = /^([a-zA-Zçãéêíóôú][a-zA-Z0-9çãéêíóôú³²]{0,11}\.?)(?=\s|$)\s*(.*)$/;
  for (const l of linhas) {
    const n = normalizarTexto(l);
    if (/^obs\b|^observ/.test(n)) {
      observacoes.push(l.replace(/^obs\.?:?\s*/i, ""));
      continue;
    }
    const m = l.match(RE_ITEM);
    if (!m || ehLinhaDeCabecalho(n)) {
      if (!ehLinhaDeCabecalho(n) && n.length > 3) linhasIgnoradas.push(l);
      continue;
    }
    let qtd = Number(m[1].replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
    let unidadeInformada: string | null = null;
    let descricao = m[2].trim();
    const tok = descricao.match(RE_UNIDADE);
    const u = tok ? lerUnidade(tok[1]) : null;
    if (tok && u && tok[2].trim()) {
      unidadeInformada = u.unidade;
      qtd *= u.fator;
      // "Barra roscada", "Barra perfilado": a palavra também faz parte do nome do produto.
      descricao = /^(barra|caixa|rolo|lata|balde|kit|conjunto)$/i.test(tok[1]) ? descricao : tok[2].replace(/^(de|do|da)\s+/i, "");
    }
    descricao = descricao.replace(/\s+/g, " ").replace(/\s*-?\s*cada\s*$/i, "").trim();
    // "Tubo cobre" numa linha e "15m 5/8" na de baixo: o nome vem do título acima.
    if (!/\p{L}{3,}/u.test(descricao) && linhasIgnoradas.length) descricao = `${linhasIgnoradas.at(-1)} ${descricao}`.trim();
    if (!(qtd > 0)) continue;

    const candidatos = buscarMateriais(descricao, ctx.catalogo, 3);
    const melhor = candidatos[0];
    let situacao: ItemInterpretado["situacao"] = "novo";
    let aviso: string | null = null;
    if (melhor) {
      const numerosMsg = numerosDe(descricao);
      const cat = ctx.catalogo.find((c) => c.id === melhor.id)!;
      const textoCat = normalizarTexto([cat.nomePadronizado, ...cat.sinonimos].join(" ")).replace(/(\d),(\d)/g, "$1.$2");
      const faltando = numerosMsg.filter((x) => !textoCat.includes(x));
      const unidadeOk = !unidadeInformada || unidadeInformada === melhor.unidade;
      if ((melhor.motivo !== "semelhanca" || melhor.pontuacao >= 0.6) && faltando.length === 0 && unidadeOk) situacao = "catalogo";
      else if (melhor.pontuacao >= 0.45) {
        situacao = "confirmar";
        aviso = faltando.length
          ? `Medida ${faltando.join(", ")} não bate com "${melhor.nomePadronizado}".`
          : !unidadeOk
            ? `Veio em ${unidadeInformada}, o catálogo usa ${melhor.unidade}.`
            : `Parecido com "${melhor.nomePadronizado}". Confira.`;
      }
    }
    const categoria = adivinharCategoria(descricao);
    itens.push({
      linha: l,
      textoOriginal: descricao,
      quantidade: qtd,
      unidadeInformada,
      situacao,
      materialId: situacao === "catalogo" ? melhor.id : null,
      candidatos: candidatos.map((c) => ({ id: c.id, nomePadronizado: c.nomePadronizado, unidade: c.unidade, pontuacao: c.pontuacao })),
      sugestaoNovo: { nome: padronizarNome(descricao), unidade: unidadeInformada ?? "un", categoria },
      aviso,
    });
  }
  if (!itens.length) alertas.push("Não encontrei itens com quantidade. Formato esperado: “20 sc cimento CP2” (um item por linha).");

  return {
    obraId,
    obraMotivo,
    solicitante,
    dataPedido,
    dataNecessidade: nec?.data ?? null,
    necessidadeMotivo: nec?.motivo ?? null,
    urgente: nec?.urgente ?? false,
    cnpjs,
    cno,
    alertas,
    observacoes,
    itens,
    linhasIgnoradas,
  };
}
