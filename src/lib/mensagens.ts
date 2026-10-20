// Textos prontos para WhatsApp. Usado pela tela e pela skill mensagem-cotacao.
import { formatarData } from "./datas";
import { formatarNumero } from "./dinheiro";
import { formatarCnpj } from "./normalizar";

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
    "Por favor, informe: preço unitário (com ou sem IPI), frete, prazo de entrega (e a partir de quando conta), condição de pagamento, desconto à vista e validade da proposta.",
    d.urgente ? "Como é urgente, se conseguir me responder ainda hoje agradeço muito!" : "Obrigado!",
  ].join("\n");
}
