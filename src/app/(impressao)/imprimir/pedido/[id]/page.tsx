import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { obterEmpresa } from "@/server/dados/empresa";
import { obterPedido } from "@/server/dados/pedidos";
import { formatarData } from "@/lib/datas";
import { formatarNumero, formatarPercentual, formatarReais } from "@/lib/dinheiro";
import { formatarCnpj, formatarWhatsapp } from "@/lib/normalizar";
import { Folha } from "../../../folha";

export async function generateMetadata({ params }: PageProps<"/imprimir/pedido/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = obterPedido(getDb(), Number(id));
  return { title: p?.numero ?? `Pedido rascunho ${id}` };
}

export default async function ImprimirPedidoPage({ params }: PageProps<"/imprimir/pedido/[id]">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const p = obterPedido(db, Number(id));
  if (!p) notFound();
  const empresa = obterEmpresa(db);
  const rascunho = !p.numero;
  const subtotal = p.itens.reduce((s, i) => s + i.totalCentavos, 0);
  const th = "border border-zinc-300 bg-zinc-100 px-2 py-1.5 text-left font-semibold";
  const td = "border border-zinc-300 px-2 py-1.5";

  return (
    <Folha
      empresa={empresa}
      titulo="Pedido de compra"
      subtitulo={
        <>
          <div className="text-[15px] font-bold text-zinc-900">{p.numero ?? "RASCUNHO"}</div>
          <div>Emissão: {formatarData(p.dataEmissao)}</div>
          {p.status === "cancelado" && <div className="font-bold text-red-700">CANCELADO</div>}
        </>
      }
    >
      {rascunho && (
        <div className="mb-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
          Prévia — pedido ainda não aprovado/emitido. Não enviar ao fornecedor.
        </div>
      )}

      <section className="mb-4 grid grid-cols-2 gap-4">
        <Caixa rotulo="Fornecedor">
          <div className="text-[13px] font-semibold">{p.fornecedor}</div>
          {p.fornecedorCnpj && <div>CNPJ {formatarCnpj(p.fornecedorCnpj)}</div>}
          <div>{[p.fornecedorContato, formatarWhatsapp(p.fornecedorWhatsapp)].filter(Boolean).join(" · ")}</div>
          {p.fornecedorEmail && <div>{p.fornecedorEmail}</div>}
          {p.fornecedorCidade && <div className="text-zinc-600">{p.fornecedorCidade}</div>}
        </Caixa>
        <Caixa rotulo="Faturar para" destaque>
          <div className="text-[13px] font-semibold">{p.obraRazaoSocial ?? empresa.razaoSocial}</div>
          <div>CNPJ {formatarCnpj(p.obraCnpj ?? empresa.cnpj) || "—"}</div>
          {p.obraCno && <div>CNO {p.obraCno}</div>}
          <div className="mt-1 font-medium">Obra: {p.obra}</div>
        </Caixa>
      </section>

      <section className="mb-4 grid grid-cols-4 gap-3">
        <Dado rotulo="Local de entrega" valor={`${p.obraEndereco ?? "—"}${p.obraCep ? ` · CEP ${p.obraCep}` : ""}`} span />
        <Dado rotulo="Entrega até" valor={formatarData(p.prazoPrometido)} forte />
        <Dado rotulo="Pagamento" valor={p.condicaoPagamento ?? "—"} />
      </section>

      <table className="tabular w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`${th} w-8 text-center`}>#</th>
            <th className={th}>Descrição</th>
            <th className={`${th} w-20 text-right`}>Qtd.</th>
            <th className={`${th} w-10`}>Un.</th>
            <th className={`${th} w-24 text-right`}>Unitário</th>
            <th className={`${th} w-28 text-right`}>Total</th>
          </tr>
        </thead>
        <tbody>
          {p.itens.map((i, n) => (
            <tr key={i.id} className="sem-quebra">
              <td className={`${td} text-center`}>{n + 1}</td>
              <td className={td}>
                <div className="font-medium">{i.material}</div>
                {(i.marca || i.especificacao) && <div className="text-[10px] text-zinc-600">{[i.marca, i.especificacao].filter(Boolean).join(" · ")}</div>}
              </td>
              <td className={`${td} text-right`}>{formatarNumero(i.quantidade)}</td>
              <td className={td}>{i.unidade}</td>
              <td className={`${td} text-right`}>{formatarReais(i.precoUnitarioCentavos)}</td>
              <td className={`${td} text-right`}>{formatarReais(i.totalCentavos)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className={`${td} text-right`} colSpan={5}>
              Total dos itens
            </td>
            <td className={`${td} text-right`}>{formatarReais(subtotal)}</td>
          </tr>
          {p.descontoBp > 0 && (
            <tr>
              <td className={`${td} text-right`} colSpan={5}>
                Desconto para pagamento à vista ({formatarPercentual(p.descontoBp / 10000)})
              </td>
              <td className={`${td} text-right`}>−{formatarReais(subtotal - (p.valorTotalCentavos - p.freteCentavos))}</td>
            </tr>
          )}
          <tr>
            <td className={`${td} text-right`} colSpan={5}>
              Frete
            </td>
            <td className={`${td} text-right`}>{p.freteCentavos ? formatarReais(p.freteCentavos) : "CIF (incluso)"}</td>
          </tr>
          <tr className="font-bold">
            <td className={`${td} bg-zinc-50 text-right`} colSpan={5}>
              Total do pedido
            </td>
            <td className={`${td} bg-zinc-50 text-right text-[12.5px]`}>{formatarReais(p.valorTotalCentavos)}</td>
          </tr>
        </tfoot>
      </table>

      <section className="sem-quebra mt-4 grid grid-cols-3 gap-3 text-[11px]">
        <Dado rotulo="Requisição" valor={`Nº ${p.requisicaoId} · ${p.solicitante}`} />
        <Dado rotulo="Aprovado por" valor={p.aprovadoPor ? `${p.aprovadoPor} em ${formatarData(p.dataAprovacao)}` : "—"} />
        <Dado rotulo="Contato compras" valor={[empresa.comprador, empresa.telefone].filter(Boolean).join(" · ") || "—"} />
      </section>

      {(empresa.rodapePedido || p.observacoes) && (
        <section className="sem-quebra mt-4 rounded border border-zinc-300 bg-zinc-50 p-3 text-[10.5px] leading-relaxed text-zinc-700">
          {p.observacoes && (
            <p className="mb-1">
              <strong>Observações:</strong> {p.observacoes}
            </p>
          )}
          {empresa.rodapePedido && <p>{empresa.rodapePedido}</p>}
          <p className="mt-1 font-medium">Informar o nº {p.numero ?? "do pedido"} na nota fiscal.</p>
        </section>
      )}

      <section className="sem-quebra mt-12 grid grid-cols-2 gap-12 text-center text-[11px]">
        <div className="border-t border-zinc-400 pt-1.5">
          {empresa.comprador ?? "Compras"} · {empresa.nomeFantasia ?? empresa.razaoSocial}
        </div>
        <div className="border-t border-zinc-400 pt-1.5">Fornecedor — de acordo</div>
      </section>
    </Folha>
  );
}

function Caixa({ rotulo, destaque, children }: { rotulo: string; destaque?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded p-3 ${destaque ? "border-2 border-[#0F4C5C]/70" : "border border-zinc-300"}`}>
      <div className="mb-0.5 text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">{rotulo}</div>
      {children}
    </div>
  );
}

function Dado({ rotulo, valor, forte, span }: { rotulo: string; valor: string; forte?: boolean; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">{rotulo}</div>
      <div className={forte ? "text-[13px] font-bold text-[#0F4C5C]" : "font-medium"}>{valor}</div>
    </div>
  );
}
