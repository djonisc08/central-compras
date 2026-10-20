import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { obterEmpresa } from "@/server/dados/empresa";
import { calcularIndicadores, periodoDoMes } from "@/server/dados/indicadores";
import { formatarData, formatarMes, hojeISO } from "@/lib/datas";
import { formatarPercentual, formatarReais } from "@/lib/dinheiro";
import { FORMULAS, META_URGENTES } from "@/lib/kpis";
import { Folha } from "../../folha";

export const metadata: Metadata = { title: "Relatório de compras" };

export default async function ImprimirRelatorioPage({ searchParams }: PageProps<"/imprimir/relatorio">) {
  await connection();
  const sp = await searchParams;
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hojeISO().slice(0, 7);
  const db = getDb();
  const empresa = obterEmpresa(db);
  const ind = calcularIndicadores(db, periodoDoMes(mes));
  const maxObra = Math.max(1, ...ind.gastoPorObra.map((g) => g.total));
  const altas = ind.variacoes.filter((v) => (v.variacao ?? 0) > 0.02).slice(0, 5);
  const baixas = [...ind.variacoes].reverse().filter((v) => (v.variacao ?? 0) < -0.02).slice(0, 5);
  const classeA = ind.abc.filter((x) => x.classe === "A");

  return (
    <Folha
      empresa={empresa}
      titulo="Relatório de compras"
      subtitulo={
        <>
          <div className="text-[15px] font-bold text-zinc-900 capitalize">{formatarMes(mes)}</div>
          <div>
            {formatarData(ind.periodo.inicio)} a {formatarData(ind.periodo.fim)}
          </div>
        </>
      }
    >
      <Sobretitulo>Resultado do mês</Sobretitulo>
      <section className="mb-5 grid grid-cols-4 gap-2.5">
        <Kpi rotulo="Gasto" valor={formatarReais(ind.gasto)} detalhe={`${ind.qtdPedidos} pedidos emitidos`} />
        <Kpi rotulo="Economia na cotação" valor={formatarReais(ind.costAvoidance)} detalhe="vs maior proposta" verde />
        <Kpi
          rotulo="Saving"
          valor={formatarReais(ind.saving)}
          detalhe={`vs último preço pago${ind.itensSemBase ? ` · ${ind.itensSemBase} itens sem base` : ""}`}
          verde={ind.saving > 0}
          vermelho={ind.saving < 0}
        />
        <Kpi rotulo="Lead time médio" valor={ind.leadTimeMedio != null ? `${ind.leadTimeMedio.toFixed(1).replace(".", ",")} dias` : "—"} detalhe="requisição → pedido" />
        <Kpi
          rotulo="Compras urgentes"
          valor={formatarPercentual(ind.pctUrgentes)}
          detalhe={`${ind.urgentes} de ${ind.requisicoes} · meta < ${formatarPercentual(META_URGENTES)}`}
          vermelho={(ind.pctUrgentes ?? 0) > META_URGENTES}
        />
        <Kpi rotulo="Pontualidade" valor={formatarPercentual(ind.pontualidade)} detalhe={`${ind.noPrazo} de ${ind.entregues} entregas no prazo`} />
        <Kpi rotulo="Não conformes" valor={String(ind.naoConformes)} detalhe="entregas com problema" vermelho={ind.naoConformes > 0} />
        <Kpi rotulo="Fornecedores" valor={String(ind.fornecedores.length)} detalhe="com pedido no mês" />
      </section>

      <section className="sem-quebra mb-5 grid grid-cols-2 gap-4">
        <div className="rounded border-l-4 border-emerald-600 bg-emerald-50/60 p-3">
          <Sobretitulo cor="text-emerald-800">Destaques</Sobretitulo>
          <ul className="grid gap-1 text-[11px] leading-snug">
            {(ind.destaques.length ? ind.destaques : ["Sem destaques no período."]).map((d) => (
              <li key={d}>• {d}</li>
            ))}
          </ul>
        </div>
        <div className="rounded border-l-4 border-red-600 bg-red-50/60 p-3">
          <Sobretitulo cor="text-red-800">Alertas</Sobretitulo>
          <ul className="grid gap-1 text-[11px] leading-snug">
            {(ind.alertas.length ? ind.alertas : ["Nenhum alerta no período."]).map((a) => (
              <li key={a}>• {a}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="sem-quebra mb-5 grid grid-cols-2 gap-6">
        <div>
          <Sobretitulo>Gasto por obra</Sobretitulo>
          <div className="grid gap-2">
            {ind.gastoPorObra.map((g) => (
              <div key={g.nome}>
                <div className="mb-0.5 flex justify-between text-[11px]">
                  <span>{g.nome}</span>
                  <span className="tabular font-semibold">{formatarReais(g.total)}</span>
                </div>
                <div className="h-2 rounded bg-zinc-100">
                  <div className="h-2 rounded bg-[#0F4C5C]" style={{ width: `${(g.total / maxObra) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Sobretitulo>Curva ABC · classe A</Sobretitulo>
          <p className="mb-1.5 text-[10.5px] text-zinc-600">
            {classeA.length} materiais = {formatarPercentual(classeA.at(-1)?.acumulado ?? 0)} do gasto. Foco de negociação.
          </p>
          <table className="tabular w-full text-[10.5px]">
            <tbody>
              {classeA.slice(0, 8).map((x) => (
                <tr key={x.material} className="border-b border-zinc-200">
                  <td className="py-0.5 pr-2">{x.material}</td>
                  <td className="py-0.5 text-right">{formatarReais(x.valor)}</td>
                  <td className="w-12 py-0.5 text-right text-zinc-500">{formatarPercentual(x.participacao)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="sem-quebra mb-5">
        <Sobretitulo>Fornecedores do mês</Sobretitulo>
        <table className="tabular w-full border-collapse text-[10.5px]">
          <thead>
            <tr className="bg-[#1f2a37] text-white">
              {["Fornecedor", "Gasto", "Pedidos", "Pontualidade", "Nota"].map((h, i) => (
                <th key={h} className={`px-2 py-1 font-semibold ${i ? "text-right" : "text-left"}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ind.fornecedores.map((f) => (
              <tr key={f.fornecedor} className="border-b border-zinc-200">
                <td className="px-2 py-1">{f.fornecedor}</td>
                <td className="px-2 py-1 text-right">{formatarReais(f.gasto)}</td>
                <td className="px-2 py-1 text-right">{f.pedidos}</td>
                <td className={`px-2 py-1 text-right ${f.pontualidade != null && f.pontualidade < 0.8 ? "font-semibold text-red-700" : ""}`}>
                  {formatarPercentual(f.pontualidade)}
                </td>
                <td className="px-2 py-1 text-right">{f.nota != null ? f.nota.toFixed(1).replace(".", ",") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(altas.length > 0 || baixas.length > 0) && (
        <section className="sem-quebra mb-5 grid grid-cols-2 gap-6">
          <Variacoes titulo="Maiores altas de preço" lista={altas} />
          <Variacoes titulo="Maiores quedas de preço" lista={baixas} />
        </section>
      )}

      <section className="sem-quebra mt-4 border-t border-zinc-300 pt-2 text-[9px] leading-relaxed text-zinc-500">
        <p>
          <strong>Saving:</strong> {FORMULAS.saving} <strong>Economia na cotação:</strong> {FORMULAS.costAvoidance}{" "}
          <strong>Pontualidade:</strong> {FORMULAS.pontualidade} <strong>Variação:</strong> {FORMULAS.variacao}
        </p>
      </section>
    </Folha>
  );
}

function Sobretitulo({ children, cor = "text-[#B4532A]" }: { children: React.ReactNode; cor?: string }) {
  return <div className={`mb-1.5 text-[9.5px] font-bold tracking-[0.08em] uppercase ${cor}`}>{children}</div>;
}

function Kpi({ rotulo, valor, detalhe, verde, vermelho }: { rotulo: string; valor: string; detalhe?: string; verde?: boolean; vermelho?: boolean }) {
  return (
    <div className="rounded border border-zinc-200 bg-zinc-50/60 p-2.5">
      <div className="text-[9.5px] font-semibold tracking-wide text-zinc-500 uppercase">{rotulo}</div>
      <div className={`tabular mt-0.5 text-[15px] font-bold ${verde ? "text-emerald-700" : vermelho ? "text-red-700" : "text-zinc-900"}`}>{valor}</div>
      {detalhe && <div className="text-[9.5px] text-zinc-500">{detalhe}</div>}
    </div>
  );
}

function Variacoes({ titulo, lista }: { titulo: string; lista: { material: string; variacao: number | null; precoAtual: number }[] }) {
  return (
    <div>
      <Sobretitulo>{titulo}</Sobretitulo>
      {lista.length === 0 ? (
        <p className="text-[10.5px] text-zinc-500">—</p>
      ) : (
        <table className="tabular w-full text-[10.5px]">
          <tbody>
            {lista.map((v) => (
              <tr key={v.material} className="border-b border-zinc-200">
                <td className="py-0.5 pr-2">{v.material}</td>
                <td className="py-0.5 text-right">{formatarReais(Math.round(v.precoAtual))}</td>
                <td className={`w-14 py-0.5 text-right font-semibold ${(v.variacao ?? 0) > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {(v.variacao ?? 0) > 0 ? "+" : ""}
                  {formatarPercentual(v.variacao)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
