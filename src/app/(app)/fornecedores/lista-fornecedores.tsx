"use client";

import { useMemo, useState } from "react";
import { MessageCircleIcon, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vazio } from "@/components/vazio";
import type { Categoria } from "@/db/schema";
import { formatarCnpj, formatarWhatsapp, linkWhatsapp, normalizarTexto } from "@/lib/normalizar";
import type { FornecedorComCategorias } from "@/server/dados/cadastros";
import { FornecedorDialog } from "./fornecedor-dialog";

export function ListaFornecedores({
  fornecedores,
  categorias,
  buscaInicial,
}: {
  fornecedores: FornecedorComCategorias[];
  categorias: Categoria[];
  buscaInicial?: string;
}) {
  const [busca, setBusca] = useState(buscaInicial ?? "");
  const [categoria, setCategoria] = useState("todas");

  const filtrados = useMemo(() => {
    const b = normalizarTexto(busca);
    return fornecedores.filter(
      (f) =>
        (categoria === "todas" || f.categoriaIds.includes(Number(categoria))) &&
        (!b || normalizarTexto(`${f.nome} ${f.cidade ?? ""} ${f.contato ?? ""} ${f.cnpj ?? ""}`).includes(b)),
    );
  }, [fornecedores, busca, categoria]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, cidade, contato ou CNPJ" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger className="sm:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {categorias.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {filtrados.length === 0 ? (
        <Vazio titulo="Nenhum fornecedor encontrado" className="m-4" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fornecedor</TableHead>
              <TableHead className="hidden lg:table-cell">Categorias</TableHead>
              <TableHead className="hidden md:table-cell">Contato</TableHead>
              <TableHead className="hidden xl:table-cell">CNPJ</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((f) => {
              const wa = linkWhatsapp(f.whatsapp);
              return (
                <TableRow key={f.id} className={f.ativo ? "" : "opacity-55"}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium">
                      {f.nome}
                      {!f.ativo && <Badge tom="contorno">Inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{f.cidade}</div>
                  </TableCell>
                  <TableCell className="hidden max-w-sm lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {f.categorias.map((c) => (
                        <Badge key={c} tom="neutro" className="font-normal">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div>{f.contato ?? "—"}</div>
                    <div className="tabular text-xs text-muted-foreground">{formatarWhatsapp(f.whatsapp)}</div>
                  </TableCell>
                  <TableCell className="tabular hidden text-muted-foreground xl:table-cell">{formatarCnpj(f.cnpj) || "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {wa && (
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp de ${f.nome}`}>
                            <MessageCircleIcon className="text-st-ok" />
                          </a>
                        </Button>
                      )}
                      <FornecedorDialog fornecedor={f} categorias={categorias}>
                        <Button variant="ghost" size="xs">
                          Editar
                        </Button>
                      </FornecedorDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
