// Textos prontos para WhatsApp. Usado pela tela e pela skill mensagem-cotacao.
import { formatarData } from "./datas";
import { formatarNumero, formatarReais } from "./dinheiro";
import { formatarCnpj, formatarWhatsapp } from "./normalizar";

export type DadosMensagemCotacao = {
  requisicaoId: number;
  obra: string;
  enderecoObra: string | null;
  dataNecessidade: string;
  urgente: boolean;
  itens: { material: string; quantidade: number; unidade: string; especificacao: string | null }[];
  empresa: string;
  comprador?: string | null;
  contato?: string | null;
  /** Dados da ficha cadastral da obra (faturamento). */
  faturamento?: { razaoSocial: string | null; cnpj: string | null; cno: string | null; cep: string | null };
};

export function mensagemCotacao(d: DadosMensagemCotacao): string {
  const saudacao = d.contato ? `Olá, ${d.contato.split(" ")[0]}! Tudo bem?` : "Olá! Tudo bem?";
  const quem = d.comprador ? `Aqui é ${d.comprador}, da ${d.empresa}.` : `Aqui é do setor de compras da ${d.empresa}.`;
  const linhas = d.itens.map(
    (i, n) =>
      `${n + 1}. ${i.material} — *${formatarNumero(i.quantidade)} ${i.unidade}*${i.especificacao ? ` (${i.especificacao})` : ""}`,
  );
  const f = d.faturamento;
  const faturar =
    f && (f.razaoSocial || f.cnpj)
      ? [`*Faturar para:* ${f.razaoSocial ?? d.empresa}${f.cnpj ? ` – CNPJ ${formatarCnpj(f.cnpj)}` : ""}${f.cno ? ` – CNO ${f.cno}` : ""}`]
      : [];
  return [
    saudacao,
    `${quem} Pode me passar orçamento dos itens abaixo?`,
    "",
    `*Obra:* ${d.obra}${d.enderecoObra ? ` – ${d.enderecoObra}` : ""}${f?.cep ? ` – CEP ${f.cep}` : ""}`,
    ...faturar,
    `*Entrega até:* ${formatarData(d.dataNecessidade)}${d.urgente ? " ⚠️ *URGENTE*" : ""}`,
    `*Ref.:* Cotação nº ${d.requisicaoId}`,
    "",
    ...linhas,
    "",
    "Por favor, informe: preço unitário (com ou sem IPI), frete, prazo de entrega (e a partir de quando conta), condição de pagamento, desconto à vista e validade da proposta. Se não tiver algum item, pode cotar só os que tiver.",
    d.urgente ? "Como é urgente, se conseguir me responder ainda hoje agradeço muito!" : "Obrigado!",
  ].join("\n");
}

/** Lembrete para o fornecedor que ainda não respondeu a cotação. */
export function mensagemCobranca(d: { requisicaoId: number; obra: string; contato: string | null; urgente: boolean; qtdItens: number }) {
  const nome = d.contato ? `, ${d.contato.split(" ")[0]}` : "";
  return [
    `Oi${nome}! Conseguiu ver a cotação nº ${d.requisicaoId} (${d.obra}, ${d.qtdItens} ${d.qtdItens === 1 ? "item" : "itens"})?`,
    d.urgente ? "É *urgente* — se puder me mandar ainda hoje, mesmo que só dos itens que tiver, ajuda muito!" : "Se puder me mandar o orçamento, mesmo que só dos itens que tiver, agradeço!",
  ].join("\n");
}

/** Mensagem de envio do pedido emitido ao fornecedor. */
export function mensagemPedido(d: {
  numero: string;
  fornecedorContato: string | null;
  empresa: string;
  comprador: string | null;
  obra: string;
  endereco: string | null;
  cep: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  cno: string | null;
  prazoPrometido: string | null;
  condicao: string | null;
  total: string;
  itens: { material: string; quantidade: number; unidade: string }[];
}) {
  const saudacao = d.fornecedorContato ? `Olá, ${d.fornecedorContato.split(" ")[0]}!` : "Olá!";
  return [
    `${saudacao} Segue o *pedido de compra ${d.numero}* da ${d.empresa}.`,
    "",
    ...d.itens.map((i) => `• ${formatarNumero(i.quantidade)} ${i.unidade} — ${i.material}`),
    "",
    `*Total:* ${d.total}${d.condicao ? ` · ${d.condicao}` : ""}`,
    `*Entrega até:* ${formatarData(d.prazoPrometido)}`,
    `*Local:* ${d.obra}${d.endereco ? ` – ${d.endereco}` : ""}${d.cep ? ` – CEP ${d.cep}` : ""}`,
    `*Faturar para:* ${d.razaoSocial ?? d.empresa}${d.cnpj ? ` – CNPJ ${formatarCnpj(d.cnpj)}` : ""}${d.cno ? ` – CNO ${d.cno}` : ""}`,
    "",
    `Por favor, informe o nº ${d.numero} na nota fiscal e confirme o recebimento deste pedido. O PDF segue em anexo.`,
    d.comprador ? `Obrigado! ${d.comprador}` : "Obrigado!",
  ].join("\n");
}

export type PedidoParaRecebimento = {
  numero: string | null;
  fornecedor: string;
  fornecedorContato: string | null;
  fornecedorWhatsapp: string | null;
  obra: string;
  prazoPrometido: string | null;
  valorTotalCentavos: number;
  itens: { quantidade: number; unidade: string; material: string }[];
};

/** Resumo dos pedidos fechados para quem vai receber o material na obra. */
export function mensagemRecebimento(pedidos: PedidoParaRecebimento[], opcoes: { titulo: string; comValores: boolean }) {
  const blocos = pedidos.map((p) =>
    [
      `*${p.numero ?? "Pedido"} · ${p.fornecedor}*`,
      `Obra: ${p.obra}${p.prazoPrometido ? ` · entrega prevista *${formatarData(p.prazoPrometido)}*` : ""}`,
      ...(p.fornecedorContato || p.fornecedorWhatsapp
        ? [`Contato: ${[p.fornecedorContato, formatarWhatsapp(p.fornecedorWhatsapp)].filter(Boolean).join(" · ")}`]
        : []),
      ...p.itens.map((i) => `• ${formatarNumero(i.quantidade)} ${i.unidade} – ${i.material}`),
      ...(opcoes.comValores ? [`Valor: ${formatarReais(p.valorTotalCentavos)}`] : []),
    ].join("\n"),
  );
  return [
    `*${opcoes.titulo}*`,
    `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} para receber. Na entrega, confira quantidade, material e se a nota fiscal traz o nº do pedido.`,
    "",
    blocos.join("\n\n"),
  ].join("\n");
}
