import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { itensParaFornecedor, lerIds } from "@/server/dados/cotacao";
import { fornecedores } from "@/db/schema";
import { obterEmpresa } from "@/server/dados/empresa";
import { obterRequisicao } from "@/server/dados/requisicoes";
import { formatarData, hojeISO, somarDias } from "@/lib/datas";
import { formatarNumero } from "@/lib/dinheiro";
import { formatarCnpj } from "@/lib/normalizar";
import { Folha } from "../../../folha";

export async function generateMetadata({ params }: PageProps<"/imprimir/cotacao/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Solicitação de cotação ${id}` };
}

/** Solicitação de cotação (RFQ) para enviar ao fornecedor preencher. */
export default async function ImprimirCotacaoPage({ params, searchParams }: PageProps<"/imprimir/cotacao/[id]">) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  const db = getDb();
  const r = obterRequisicao(db, Number(id));
  if (!r) notFound();
  const empresa = obterEmpresa(db);
  const fornecedorId = Number(sp.fornecedor) || null;
  const fornecedor = fornecedorId ? db.select().from(fornecedores).where(eq(fornecedores.id, fornecedorId)).get() : null;
  const itens = itensParaFornecedor(db, r.id, fornecedorId, lerIds(sp.itens));
  const hoje = hojeISO();
  const prazoResposta = r.urgente ? hoje : somarDias(hoje, 2);

  const th = "border border-marca-preto bg-marca-preto px-2 py-1.5 text-left font-semibold text-white";
  const td = "border border-zinc-300 px-2 py-2";
  const preencher = "border border-zinc-300 bg-amber-50/60 px-2 py-2";

  return (
    <Folha
      empresa={empresa}
      titulo="Solicitação de cotação"
      subtitulo={
        <>
          <div>
            Nº <strong>{r.id}</strong> · {formatarData(hoje)}
          </div>
          {r.urgente && <div className="font-bold text-[#ff8a7a]">URGENTE</div>}
        </>
      }
    >
      <section className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded border border-zinc-300 p-3">
          <Rotulo>Fornecedor</Rotulo>
          <div className="text-[13px] font-semibold">{fornecedor?.nome ?? "____________________________________"}</div>
          {fornecedor?.contato && <div>A/C {fornecedor.contato}</div>}
          {fornecedor?.cnpj && <div>CNPJ {formatarCnpj(fornecedor.cnpj)}</div>}
        </div>
        <div className="rounded border border-zinc-300 p-3">
          <Rotulo>Responder até</Rotulo>
          <div className="text-[13px] font-semibold">{formatarData(prazoResposta)}</div>
          <div>
            {empresa.comprador ?? "Compras"} · {empresa.telefone}
          </div>
          <div>{empresa.email}</div>
        </div>
      </section>

      <section className="mb-4 rounded border-2 border-marca-verde p-3">
        <Rotulo>Dados para orçamento e faturamento — usar exatamente estes dados</Rotulo>
        <div className="mt-1 grid grid-cols-[1.4fr_1fr] gap-x-6 gap-y-1">
          <Linha rotulo="Razão social" valor={r.razaoSocialObra ?? empresa.razaoSocial} />
          <Linha rotulo="CNPJ" valor={formatarCnpj(r.cnpjObra ?? empresa.cnpj) || "—"} />
          <Linha rotulo="Obra" valor={r.obra} />
          <Linha rotulo="CNO" valor={r.cnoObra ?? "—"} />
          <Linha rotulo="Entrega" valor={`${r.enderecoObra ?? "—"}${r.cepObra ? ` · CEP ${r.cepObra}` : ""}`} />
          <Linha rotulo="Necessidade na obra" valor={formatarData(r.dataNecessidade)} destaque />
        </div>
      </section>

      <table className="tabular w-full border-collapse text-[11px]">
        <thead>
          <tr>
            <th className={`${th} w-8 text-center`}>#</th>
            <th className={th}>Descrição / especificação</th>
            <th className={`${th} w-16 text-right`}>Qtd.</th>
            <th className={`${th} w-10`}>Un.</th>
            <th className={`${th} w-28`}>Marca / modelo</th>
            <th className={`${th} w-24 text-right`}>Preço unit. (R$)</th>
            <th className={`${th} w-24 text-right`}>Total (R$)</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i, n) => (
            <tr key={i.id} className="sem-quebra">
              <td className={`${td} text-center`}>{n + 1}</td>
              <td className={td}>
                <div className="font-medium">{i.material}</div>
                {i.especificacao && <div className="text-[10px] text-zinc-600">{i.especificacao}</div>}
              </td>
              <td className={`${td} text-right`}>{formatarNumero(i.quantidade)}</td>
              <td className={td}>{i.unidade}</td>
              <td className={preencher} />
              <td className={preencher} />
              <td className={preencher} />
            </tr>
          ))}
        </tbody>
      </table>

      <section className="sem-quebra mt-4">
        <Rotulo>Condições comerciais (preencher)</Rotulo>
        <table className="mt-1 w-full border-collapse text-[11px]">
          <tbody>
            {[
              ["Frete", "[  ] CIF (incluso)     [  ] FOB  ·  valor R$ __________"],
              ["Preços incluem IPI/impostos?", "[  ] Sim     [  ] Não  ·  alíquota IPI ______ %"],
              ["Condição de pagamento (a prazo)", ""],
              ["Desconto à vista / antecipado", "__________ %"],
              ["Prazo de entrega na obra", "______ dias, contados a partir de: [  ] pedido   [  ] faturamento   [  ] liberação de crédito"],
              ["Validade da proposta", ""],
              ["Nº do orçamento / pedido", ""],
              ["Vendedor / representante e contato", ""],
            ].map(([rot, dica]) => (
              <tr key={rot}>
                <td className={`${td} w-[38%] bg-zinc-50 font-medium`}>{rot}</td>
                <td className={`${preencher} text-[10px] text-zinc-500`}>{dica}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="sem-quebra mt-4 text-[10.5px] leading-relaxed text-zinc-700">
        <p>
          <strong>Observações:</strong> informar se algum item não for atendido ou tiver similar. Entrega no endereço da obra acima
          (não no escritório). Faturar com a razão social, CNPJ e CNO informados. Responder por WhatsApp ou e-mail com este documento
          preenchido ou com o orçamento próprio do fornecedor, citando a cotação nº {r.id}.
        </p>
        {r.observacoes && (
          <p className="mt-1">
            <strong>Especificação técnica:</strong> {r.observacoes}
          </p>
        )}
      </section>

      <section className="sem-quebra mt-10 grid grid-cols-2 gap-12 text-center text-[11px]">
        <div className="border-t border-zinc-400 pt-1.5">
          {empresa.comprador ?? "Compras"} · {empresa.nomeFantasia ?? empresa.razaoSocial}
        </div>
        <div className="border-t border-zinc-400 pt-1.5">Fornecedor (carimbo e assinatura)</div>
      </section>
    </Folha>
  );
}

function Rotulo({ children }: { children: React.ReactNode }) {
  return <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">{children}</div>;
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-zinc-500">{rotulo}</span>
      <span className={destaque ? "font-bold text-marca-verde-escuro" : "font-medium"}>{valor}</span>
    </div>
  );
}
