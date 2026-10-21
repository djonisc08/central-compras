import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { obterEmpresa } from "@/server/dados/empresa";
import { obterMapa } from "@/server/dados/requisicoes";
import { formatarData, hojeISO } from "@/lib/datas";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/dinheiro";
import { atendePrazo, previsaoEntrega, textoSugestao } from "@/lib/mapa";
import { formatarCnpj } from "@/lib/normalizar";
import { Folha } from "../../../folha";

export async function generateMetadata({ params }: PageProps<"/imprimir/mapa/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Mapa de cotação ${id}` };
}

export default async function ImprimirMapaPage({ params }: PageProps<"/imprimir/mapa/[id]">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const mapa = obterMapa(db, Number(id));
  if (!mapa) notFound();
  const { requisicao: r, resumo } = mapa;
  const empresa = obterEmpresa(db);
  const cols = resumo.colunas;
  const hoje = hojeISO();
  const sugestao = textoSugestao(resumo, hoje, r.dataNecessidade);
  const th = "border border-zinc-300 bg-marca-bege px-1.5 py-1 font-semibold";
  const td = "border border-zinc-300 px-1.5 py-1";

  return (
    <Folha
      empresa={empresa}
      paisagem={cols.length > 3}
      titulo="Mapa comparativo de cotação"
      subtitulo={
        <>
          <div>
            Nº <strong>{r.id}</strong> · emitido em {formatarData(hojeISO())}
          </div>
          {r.urgente && <div className="font-bold text-[#ff8a7a]">URGENTE</div>}
        </>
      }
    >
      <section className="mb-4 grid grid-cols-4 gap-3">
        <Dado rotulo="Obra" valor={r.obra} />
        <Dado rotulo="Solicitante" valor={r.solicitante} />
        <Dado rotulo="Data do pedido" valor={formatarData(r.dataPedido)} />
        <Dado rotulo="Necessidade" valor={formatarData(r.dataNecessidade)} />
        {(r.cnpjObra || r.razaoSocialObra) && (
          <div className="col-span-4">
            <Dado
              rotulo="Faturamento"
              valor={[r.razaoSocialObra, r.cnpjObra && `CNPJ ${formatarCnpj(r.cnpjObra)}`, r.cnoObra && `CNO ${r.cnoObra}`, r.enderecoObra]
                .filter(Boolean)
                .join(" · ")}
            />
          </div>
        )}
      </section>

      <table className="tabular w-full border-collapse text-[10.5px]">
        <thead>
          <tr>
            <th className={`${th} text-left`} rowSpan={2}>
              Item
            </th>
            <th className={`${th} text-right`} rowSpan={2}>
              Qtd.
            </th>
            {cols.map((c) => (
              <th key={c.proposta.id} className={`${th} text-center`} colSpan={2}>
                {c.proposta.fornecedor}
              </th>
            ))}
            <th className={`${th} text-right`} rowSpan={2}>
              Economia
            </th>
          </tr>
          <tr>
            {cols.map((c) => [
              <th key={`u${c.proposta.id}`} className={`${th} text-right font-medium`}>
                Unit.
              </th>,
              <th key={`t${c.proposta.id}`} className={`${th} text-right font-medium`}>
                Total
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {resumo.linhas.map((l) => (
            <tr key={l.item.id} className="sem-quebra">
              <td className={td}>
                {l.item.material}
                {l.item.especificacao && <span className="text-zinc-500"> · {l.item.especificacao}</span>}
              </td>
              <td className={`${td} text-right whitespace-nowrap`}>
                {formatarNumero(l.item.quantidade)} {l.item.unidade}
              </td>
              {l.celulas.map((c) => {
                const bg = c.vencedora ? "bg-marca-bege font-bold" : c.ehMenor ? "bg-[#e3f7ea]" : "";
                return [
                  <td key={`u${c.propostaId}`} className={`${td} text-right ${bg}`}>
                    {c.preco == null ? "—" : formatarReais(c.preco)}
                    {c.vencedora && " ✓"}
                  </td>,
                  <td key={`t${c.propostaId}`} className={`${td} text-right ${bg}`}>
                    {c.total == null ? "" : formatarReais(c.total)}
                  </td>,
                ];
              })}
              <td className={`${td} text-right`}>{l.economia ? formatarReais(l.economia) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {(
            [
              ["Subtotal", (c) => formatarReais(c.subtotal)],
              ...(cols.some((c) => c.descontoNegociado > 0)
                ? ([["Desconto negociado", (c) => (c.descontoNegociado ? `−${formatarReais(c.descontoNegociado)}` : "—")]] as [
                    string,
                    (c: (typeof cols)[number]) => string,
                  ][])
                : []),
              ["Frete", (c) => (c.proposta.freteCentavos ? formatarReais(c.proposta.freteCentavos) : "CIF")],
              ["Total com frete", (c) => formatarReais(c.total)],
              ...(cols.some((c) => c.totalAVista != null)
                ? ([
                    [
                      "À vista / antecipado",
                      (c) =>
                        c.totalAVista != null
                          ? `${formatarReais(c.totalAVista)} (−${formatarPercentual((c.proposta.descontoAVistaBp ?? 0) / 10000)})`
                          : "sem desconto",
                    ],
                  ] as [string, (c: (typeof cols)[number]) => string][])
                : []),
              [
                "Prazo",
                (c) =>
                  c.proposta.prazoEntregaDias == null
                    ? "—"
                    : `${c.proposta.prazoEntregaDias} dia(s)${c.proposta.prazoObservacao ? ` ${c.proposta.prazoObservacao}` : ""}`,
              ],
              [
                `Chega até ${formatarData(r.dataNecessidade)}?`,
                (c) => {
                  const ok = atendePrazo(c.proposta.prazoEntregaDias, hoje, r.dataNecessidade);
                  return ok == null ? "—" : `${ok ? "Atende" : "NÃO atende"} (~${formatarData(previsaoEntrega(c.proposta.prazoEntregaDias, hoje))})`;
                },
              ],
              ["Impostos", (c) => (c.proposta.impostosInclusos === false ? "s/ IPI" : "inclusos")],
              ["Pagamento", (c) => c.proposta.condicaoPagamento ?? "—"],
              ["Validade", (c) => formatarData(c.proposta.validade)],
            ] as [string, (c: (typeof cols)[number]) => string][]
          ).map(([rot, f]) => (
            <tr key={rot} className={rot === "Total com frete" ? "font-bold" : ""}>
              <td className={`${td} bg-zinc-50 font-semibold`} colSpan={2}>
                {rot}
              </td>
              {cols.map((c) => (
                <td key={c.proposta.id} className={`${td} text-right`} colSpan={2}>
                  {f(c)}
                </td>
              ))}
              <td className={`${td} text-right`}>{rot === "Total com frete" ? formatarReais(resumo.economiaTotal) : ""}</td>
            </tr>
          ))}
        </tfoot>
      </table>

      <section className={`sem-quebra mt-5 grid-cols-3 gap-3 ${resumo.itensComVencedor ? "grid" : "hidden"}`}>
        <Destaque rotulo="Total escolhido (com fretes)" valor={formatarReais(resumo.totalEscolhido)} />
        <Destaque rotulo="Economia na cotação" valor={formatarReais(resumo.economiaTotal)} detalhe="Maior cotação − escolhida" />
        <Destaque
          rotulo="Vencedores"
          valor={`${resumo.itensComVencedor}/${resumo.totalItens} itens`}
          detalhe={cols
            .filter((c) => c.itensVencidos)
            .map((c) => c.proposta.fornecedor)
            .join(", ")}
        />
      </section>

      <p className="mt-3 text-[10px] text-zinc-500">Legenda: verde = menor preço do item · azul/negrito com ✓ = vencedor escolhido.</p>

      <section className="sem-quebra mt-4 rounded border-l-4 border-marca-verde bg-zinc-50 p-3">
        <div className="text-[9.5px] font-semibold tracking-wide text-marca-verde-escuro uppercase">Sugestão de compras</div>
        <p className="mt-1 text-[11.5px] leading-relaxed">{sugestao}</p>
      </section>

      <section className="sem-quebra mt-4 rounded border border-zinc-300 p-3 text-[11px]">
        <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">Aprovação</div>
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
          <span className="font-medium">Fornecedor aprovado:</span>
          {cols.map((c) => (
            <span key={c.proposta.id}>[&nbsp;&nbsp;] {c.proposta.fornecedor}</span>
          ))}
        </div>
        <div className="mt-1 flex gap-5">
          <span className="font-medium">Pagamento:</span>
          <span>[&nbsp;&nbsp;] À vista</span>
          <span>[&nbsp;&nbsp;] A prazo</span>
        </div>
        <div className="mt-10 grid grid-cols-4 gap-6 text-center">
          {["Compras", "Engenharia", "Financeiro", "Diretoria"].map((a) => (
            <div key={a} className="border-t border-zinc-400 pt-1.5">
              <div className="font-medium">{a}</div>
              <div className="mt-1 text-[10px] text-zinc-500">Data: ___/___/___</div>
            </div>
          ))}
        </div>
      </section>
    </Folha>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">{rotulo}</div>
      <div className="font-medium">{valor}</div>
    </div>
  );
}

function Destaque({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded border border-zinc-300 p-2.5">
      <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">{rotulo}</div>
      <div className="text-[14px] font-bold">{valor}</div>
      {detalhe && <div className="text-[10px] text-zinc-600">{detalhe}</div>}
    </div>
  );
}
