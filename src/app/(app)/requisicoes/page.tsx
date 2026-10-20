import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ClipboardListIcon, ClipboardPasteIcon, PlusIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { STATUS_REQUISICAO, type StatusRequisicao } from "@/db/schema";
import { listarObras } from "@/server/dados/cadastros";
import { listarRequisicoes } from "@/server/dados/requisicoes";
import { PageHeader } from "@/components/page-header";
import { StatusRequisicaoBadge, UrgenteBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vazio } from "@/components/vazio";
import { diasEntre, formatarData, hojeISO, prazoRelativo } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { FiltrosRequisicoes } from "./filtros";

export const metadata: Metadata = { title: "Requisições" };

export default async function RequisicoesPage({ searchParams }: PageProps<"/requisicoes">) {
  await connection();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const statusParam = str("status");
  const status =
    statusParam === "todas"
      ? undefined
      : statusParam && (STATUS_REQUISICAO as readonly string[]).includes(statusParam)
        ? (statusParam as StatusRequisicao)
        : "em_andamento";

  const db = getDb();
  const hoje = hojeISO();
  const obras = listarObras(db);
  const lista = listarRequisicoes(db, {
    obraId: Number(str("obra")) || undefined,
    status,
    urgente: str("urgente") === "1",
    busca: str("q"),
  });

  return (
    <>
      <PageHeader
        titulo="Requisições"
        descricao="Pedidos de material das obras, do recebimento à entrega."
        acoes={
          <>
            <Button variant="outline" asChild>
              <Link href="/requisicoes/nova">
                <PlusIcon /> Digitar
              </Link>
            </Button>
            <Button asChild>
              <Link href="/requisicoes/nova?colar=1">
                <ClipboardPasteIcon /> Colar pedido
              </Link>
            </Button>
          </>
        }
      />
      <FiltrosRequisicoes obras={obras.map((o) => ({ id: o.id, nome: o.nome }))} />

      {lista.length === 0 ? (
        <Vazio
          icone={<ClipboardListIcon />}
          titulo="Nenhuma requisição com esses filtros"
          descricao="Ajuste os filtros ou crie uma nova requisição."
          className="mt-4"
        />
      ) : (
        <>
          {/* Celular: cartões */}
          <div className="mt-4 grid gap-2 md:hidden">
            {lista.map((r) => (
              <Link key={r.id} href={`/requisicoes/${r.id}`} className="rounded-xl border bg-card p-3.5 transition-colors active:bg-muted">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">
                      #{r.id} · {r.obra}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[13.5px] font-medium">{r.resumoItens}</div>
                  </div>
                  {r.urgente && <UrgenteBadge />}
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <StatusRequisicaoBadge status={r.status} />
                  <Necessidade data={r.dataNecessidade} hoje={hoje} status={r.status} />
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: tabela densa */}
          <Card className="mt-4 hidden overflow-hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-14">Nº</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead className="hidden xl:table-cell">Solicitante</TableHead>
                  <TableHead>Necessidade</TableHead>
                  <TableHead className="text-center">Propostas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map((r) => (
                  <TableRow key={r.id} className="group relative">
                    <TableCell className="tabular text-muted-foreground">
                      <Link href={`/requisicoes/${r.id}`} className="after:absolute after:inset-0">
                        #{r.id}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="flex items-center gap-2">
                        {r.urgente && <UrgenteBadge />}
                        <span className="truncate font-medium group-hover:text-primary">{r.resumoItens}</span>
                        {r.qtdItens > 3 && <span className="shrink-0 text-xs text-muted-foreground">+{r.qtdItens - 3}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.obra}</TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">{r.solicitante}</TableCell>
                    <TableCell>
                      <Necessidade data={r.dataNecessidade} hoje={hoje} status={r.status} />
                    </TableCell>
                    <TableCell className="tabular text-center">{r.qtdPropostas || "—"}</TableCell>
                    <TableCell>
                      <StatusRequisicaoBadge status={r.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">{lista.length} requisições</p>
        </>
      )}
    </>
  );
}

function Necessidade({ data, hoje, status }: { data: string; hoje: string; status: StatusRequisicao }) {
  const encerrada = ["entregue", "cancelada"].includes(status);
  const d = diasEntre(hoje, data);
  return (
    <div className="flex flex-col leading-tight md:items-start">
      <span className="tabular text-[13px]">{formatarData(data)}</span>
      {!encerrada && (
        <span
          className={cn(
            "text-[11.5px] font-medium",
            d < 0 ? "text-st-urgente" : d <= 1 ? "text-st-atencao" : "text-muted-foreground",
          )}
        >
          {prazoRelativo(data, hoje)}
        </span>
      )}
    </div>
  );
}
