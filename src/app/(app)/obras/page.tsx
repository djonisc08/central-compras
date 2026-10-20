import type { Metadata } from "next";
import { connection } from "next/server";
import { Building2Icon, PlusIcon } from "lucide-react";
import { getDb } from "@/db/client";
import { listarObras } from "@/server/dados/cadastros";
import { PageHeader } from "@/components/page-header";
import { StatusObraBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarReais } from "@/lib/dinheiro";
import { formatarCnpj } from "@/lib/normalizar";
import { ObraDialog } from "./obra-dialog";

export const metadata: Metadata = { title: "Obras" };

export default async function ObrasPage() {
  await connection();
  const obras = listarObras(getDb());

  return (
    <>
      <PageHeader
        titulo="Obras"
        descricao={`${obras.filter((o) => o.status === "ativa").length} ativas · ${obras.filter((o) => o.status === "planejada").length} planejadas`}
        acoes={
          <ObraDialog>
            <Button>
              <PlusIcon /> Nova obra
            </Button>
          </ObraDialog>
        }
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Obra</TableHead>
              <TableHead className="hidden md:table-cell">Engenheiro responsável</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Em andamento</TableHead>
              <TableHead className="text-right">Gasto total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {obras.map((o) => (
              <TableRow key={o.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground sm:flex">
                      <Building2Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{o.nome}</div>
                      <div className="truncate text-xs text-muted-foreground">{o.endereco}</div>
                      {o.cnpj && (
                        <div className="tabular truncate text-[11.5px] text-muted-foreground/80">
                          CNPJ {formatarCnpj(o.cnpj)}
                          {o.cno && <> · CNO {o.cno}</>}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">{o.engenheiroResponsavel ?? "—"}</TableCell>
                <TableCell>
                  <StatusObraBadge status={o.status} />
                </TableCell>
                <TableCell className="tabular text-right">{o.requisicoesAbertas || "—"}</TableCell>
                <TableCell className="tabular text-right font-medium">{formatarReais(o.gastoTotal)}</TableCell>
                <TableCell>
                  <ObraDialog obra={o}>
                    <Button variant="ghost" size="xs">
                      Editar
                    </Button>
                  </ObraDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
