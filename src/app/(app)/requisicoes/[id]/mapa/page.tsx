import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ChevronLeftIcon, FileSpreadsheetIcon, PlusIcon, PrinterIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { obterMapa, ultimosPrecosPagos } from "@/server/dados/requisicoes";
import { PageHeader } from "@/components/page-header";
import { StatusRequisicaoBadge, UrgenteBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Vazio } from "@/components/vazio";
import { formatarData, hojeISO } from "@/lib/datas";
import { MapaComparativo } from "./mapa-comparativo";

export async function generateMetadata({ params }: PageProps<"/requisicoes/[id]/mapa">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Mapa · Requisição #${id}` };
}

export default async function MapaPage({ params }: PageProps<"/requisicoes/[id]/mapa">) {
  await connection();
  const { id } = await params;
  const db = getDb();
  const mapa = obterMapa(db, Number(id));
  if (!mapa) notFound();
  const r = mapa.requisicao;
  const ultimos = ultimosPrecosPagos(db, r.itens.map((i) => i.materialId));
  const editavel = ["aberta", "cotando", "aguardando_aprovacao"].includes(r.status);

  return (
    <>
      <PageHeader
        antes={
          <Link href={`/requisicoes/${r.id}`} className="mb-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-4" /> Requisição #{r.id}
          </Link>
        }
        titulo={
          <span className="flex flex-wrap items-center gap-2">
            Mapa comparativo
            <StatusRequisicaoBadge status={r.status} />
            {r.urgente && <UrgenteBadge />}
          </span>
        }
        descricao={`${r.obra} · precisa até ${formatarData(r.dataNecessidade)} · ${mapa.propostas.length} propostas`}
        acoes={
          <>
            {editavel && (
              <Button variant="outline" asChild>
                <Link href={`/requisicoes/${r.id}/proposta`}>
                  <PlusIcon /> Proposta
                </Link>
              </Button>
            )}
            <Button variant="outline" asChild>
              <a href={`/imprimir/mapa/${r.id}`} target="_blank" rel="noreferrer">
                <PrinterIcon /> Imprimir
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/api/exportar/mapa/${r.id}`}>
                <FileSpreadsheetIcon /> Excel
              </a>
            </Button>
          </>
        }
      />
      {mapa.propostas.length === 0 ? (
        <Vazio
          titulo="Ainda não há propostas para comparar"
          descricao="Lance pelo menos uma proposta para montar o mapa."
          acao={
            <Button asChild>
              <Link href={`/requisicoes/${r.id}/proposta`}>
                <PlusIcon /> Lançar proposta
              </Link>
            </Button>
          }
        />
      ) : (
        <MapaComparativo
          requisicaoId={r.id}
          editavel={editavel}
          dataNecessidade={r.dataNecessidade}
          hoje={hojeISO()}
          resumo={mapa.resumo}
          ultimos={Object.fromEntries([...ultimos].map(([k, v]) => [k, v.preco]))}
        />
      )}
    </>
  );
}
