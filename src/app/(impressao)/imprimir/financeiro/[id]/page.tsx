import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { listarFornecedores } from "@/server/dados/cadastros";
import { obterEmpresa } from "@/server/dados/empresa";
import { listarPedidos, obterPedido } from "@/server/dados/pedidos";
import { obterMapa } from "@/server/dados/requisicoes";
import { formatarData, hojeISO, somarDias } from "@/lib/datas";
import { formatarNumero, formatarReais } from "@/lib/dinheiro";
import { formatarCnpj, formatarWhatsapp } from "@/lib/normalizar";
import { calcularVencimentos } from "@/lib/vencimentos";
import { Folha } from "../../../folha";

export async function generateMetadata({ params }: PageProps<"/imprimir/financeiro/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Financeiro · cotação ${id}` };
}

/** Resumo da compra aprovada para o financeiro (formato da planilha de cotação da MAX). */
export default async function ImprimirFinanceiroPage({ params }: PageProps<"/imprimir/financeiro/[id]">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const mapa = obterMapa(db, Number(id));
  if (!mapa) notFound();
  const { requisicao: r, resumo } = mapa;
  const empresa = obterEmpresa(db);
  const fornecedores = new Map(listarFornecedores(db).map((f) => [f.id, f]));
  const pedidosReq = listarPedidos(db, { requisicaoId: r.id }).filter((p) => p.status !== "cancelado");
  const pedidoDe = (fornecedorId: number) => pedidosReq.find((p) => p.fornecedorId === fornecedorId);
  const cols = resumo.colunas;
  // Faturamento corrigido nos pedidos (ex.: financeiro pediu outro CNPJ) vale sobre a ficha da obra.
  const detalhes = pedidosReq.map((p) => obterPedido(db, p.id)).filter((p) => p != null);
  const fat = detalhes[0] ?? null;
  const faturamentos = new Set(detalhes.map((p) => `${p.obraRazaoSocial}|${p.obraCnpj}`));
  const totalAprovado = pedidosReq.length
    ? pedidosReq.reduce((s, p) => s + p.valorTotalCentavos, 0)
    : resumo.totalEscolhido;

  const th = "border border-zinc-400 bg-zinc-100 px-1.5 py-1 font-semibold";
  const td = "border border-zinc-300 px-1.5 py-1";
  const vermelho = "text-[#B42318]";

  return (
    <Folha
      empresa={empresa}
      paisagem={cols.length > 2}
      titulo="Cotação aprovada · Financeiro"
      subtitulo={
        <>
          <div>
            Cotação nº <strong>{r.id}</strong> · {formatarData(hojeISO())}
          </div>
          <div>{pedidosReq.length ? `${pedidosReq.length} pedido(s) emitido(s)` : "aguardando pedido"}</div>
        </>
      }
    >
      <section className="mb-3 grid grid-cols-[1.4fr_1fr] gap-4 text-[11.5px]">
        <div className="rounded border-2 border-[#0F4C5C]/70 p-2.5">
          <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">Empresa / faturamento</div>
          <div className="font-bold">{fat?.obraRazaoSocial ?? r.razaoSocialObra ?? empresa.razaoSocial}</div>
          <div>
            CNPJ {formatarCnpj(fat?.obraCnpj ?? r.cnpjObra ?? empresa.cnpj)}
            {(fat?.obraCno ?? r.cnoObra) && <> · CNO {fat?.obraCno ?? r.cnoObra}</>}
          </div>
          <div className="text-zinc-600">{fat?.obraEndereco ?? r.enderecoObra}</div>
          {faturamentos.size > 1 && (
            <div className="mt-1 text-[10px] font-semibold text-[#B42318]">Atenção: os pedidos desta cotação têm faturamentos diferentes. Confira em cada pedido.</div>
          )}
        </div>
        <div className="rounded border border-zinc-300 p-2.5">
          <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">Departamento / obra</div>
          <div className="text-[15px] font-bold">{r.obra}</div>
          <div>
            Solicitante: {r.solicitante} · pedido em {formatarData(r.dataPedido)}
          </div>
          <div>Financeiro: financeiro@maxincorporacoes.com.br</div>
        </div>
      </section>

      <table className="tabular w-full border-collapse text-[10.5px]">
        <thead>
          <tr>
            <th className={`${th} text-left`} rowSpan={7}>
              Produtos / serviços
            </th>
            <th className={th} rowSpan={7}>
              Un.
            </th>
            <th className={th} rowSpan={7}>
              Qtd.
            </th>
            <th className={`${th} text-left`}>Fornecedor</th>
            {cols.map((c) => (
              <th key={c.proposta.id} className={`${th} ${vermelho}`}>
                {c.proposta.fornecedor}
              </th>
            ))}
          </tr>
          {(
            [
              ["Contato", (c) => fornecedores.get(c.proposta.fornecedorId)?.contato ?? c.proposta.vendedor ?? "—"],
              ["Telefone", (c) => formatarWhatsapp(fornecedores.get(c.proposta.fornecedorId)?.whatsapp) || "—"],
              ["Cond. pagto.", (c) => pedidoDe(c.proposta.fornecedorId)?.condicaoPagamento ?? c.proposta.condicaoPagamento ?? "—"],
              [
                "Prazo entrega",
                (c) => {
                  const p = pedidoDe(c.proposta.fornecedorId);
                  if (p?.prazoPrometido) return formatarData(p.prazoPrometido);
                  return c.proposta.prazoEntregaDias != null ? formatarData(somarDias(c.proposta.dataCotacao, c.proposta.prazoEntregaDias)) : "—";
                },
              ],
              ["Nº pedido", (c) => pedidoDe(c.proposta.fornecedorId)?.numero ?? "—"],
            ] as [string, (c: (typeof cols)[number]) => string][]
          ).map(([rot, f]) => (
            <tr key={rot}>
              <th className={`${th} text-left font-medium`}>{rot}</th>
              {cols.map((c) => (
                <td key={c.proposta.id} className={`${td} text-center font-medium ${vermelho}`}>
                  {f(c)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th className={`${th} text-left font-medium`}>Valor</th>
            {cols.map((c) => (
              <th key={c.proposta.id} className={`${th} font-medium`}>
                Total do item
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resumo.linhas.map((l) => (
            <tr key={l.item.id} className="sem-quebra">
              <td className={td}>{l.item.material}</td>
              <td className={`${td} text-center`}>{l.item.unidade}</td>
              <td className={`${td} text-right`}>{formatarNumero(l.item.quantidade)}</td>
              <td className={`${td} text-right`}>{l.precoEscolhido != null ? formatarReais(l.precoEscolhido) : "—"}</td>
              {l.celulas.map((c) => (
                <td key={c.propostaId} className={`${td} text-right ${c.vencedora ? `font-bold ${vermelho} bg-red-50/40` : "text-zinc-500"}`}>
                  {c.total != null ? formatarReais(c.total) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {(
            [
              ["Subtotal (aprovado)", (c) => formatarReais(c.valorVencidoBruto)],
              ["Frete", (c) => (c.itensVencidos ? (c.proposta.freteCentavos ? formatarReais(c.proposta.freteCentavos) : "CIF") : "—")],
              [
                "Desconto",
                (c) => {
                  const p = pedidoDe(c.proposta.fornecedorId);
                  const d = c.valorVencidoBruto + c.proposta.freteCentavos - (p?.valorTotalCentavos ?? c.valorVencido + c.proposta.freteCentavos);
                  return d > 0 ? `−${formatarReais(d)}` : "—";
                },
              ],
              [
                "Preço total",
                (c) => {
                  const p = pedidoDe(c.proposta.fornecedorId);
                  return c.itensVencidos ? formatarReais(p?.valorTotalCentavos ?? c.valorVencido + c.proposta.freteCentavos) : "—";
                },
              ],
            ] as [string, (c: (typeof cols)[number]) => string][]
          ).map(([rot, f]) => (
            <tr key={rot} className={rot === "Preço total" ? "font-bold" : ""}>
              <td className={`${td} bg-zinc-50`} colSpan={3} />
              <td className={`${td} bg-zinc-100 font-semibold`}>{rot}</td>
              {cols.map((c) => (
                <td key={c.proposta.id} className={`${td} bg-zinc-50 text-right ${rot === "Preço total" ? vermelho : ""}`}>
                  {f(c)}
                </td>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>

      <section className="sem-quebra mt-5">
        <div className="mb-1.5 text-[9.5px] font-bold tracking-[0.08em] text-[#B4532A] uppercase">Programação de pagamento</div>
        <table className="tabular w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#1f2a37] text-white">
              {["Fornecedor", "Pedido", "Condição", "Vencimento", "Valor"].map((h, i) => (
                <th key={h} className={`px-2 py-1 font-semibold ${i === 4 ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(pedidosReq.length
              ? pedidosReq.map((p) => ({ fornecedor: p.fornecedor, numero: p.numero, condicao: p.condicaoPagamento, base: p.dataEmissao ?? hojeISO(), total: p.valorTotalCentavos }))
              : cols
                  .filter((c) => c.itensVencidos)
                  .map((c) => ({
                    fornecedor: c.proposta.fornecedor,
                    numero: null,
                    condicao: c.proposta.condicaoPagamento,
                    base: hojeISO(),
                    total: c.valorVencido + c.proposta.freteCentavos,
                  }))
            ).flatMap((p) =>
              calcularVencimentos(p.condicao, p.base, p.total).map((v, i, todas) => (
                <tr key={`${p.fornecedor}-${i}`} className="border-b border-zinc-200">
                  <td className="px-2 py-1">{i === 0 ? p.fornecedor : ""}</td>
                  <td className="px-2 py-1">{i === 0 ? (p.numero ?? "—") : ""}</td>
                  <td className="px-2 py-1">{i === 0 ? (p.condicao ?? "—") : ""}</td>
                  <td className="px-2 py-1">
                    {v.data ? formatarData(v.data) : "a definir"}
                    {todas.length > 1 && <span className="text-zinc-500"> ({i + 1}/{todas.length})</span>}
                  </td>
                  <td className="px-2 py-1 text-right font-medium">{formatarReais(v.valor)}</td>
                </tr>
              )),
            )}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td className="px-2 py-1.5" colSpan={4}>
                Total aprovado
              </td>
              <td className="px-2 py-1.5 text-right text-[13px]">{formatarReais(totalAprovado)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-1 text-[9.5px] text-zinc-500">Vencimentos estimados a partir da data de emissão do pedido e da condição negociada. Confirmar nos boletos/NF.</p>
      </section>

      <section className="sem-quebra mt-10 grid grid-cols-3 gap-8 text-center text-[11px]">
        {["Compras", "Engenharia", "Financeiro"].map((a) => (
          <div key={a} className="border-t border-zinc-400 pt-1.5">
            <div className="font-medium">{a}</div>
            <div className="mt-1 text-[10px] text-zinc-500">Data: ___/___/___</div>
          </div>
        ))}
      </section>
    </Folha>
  );
}
