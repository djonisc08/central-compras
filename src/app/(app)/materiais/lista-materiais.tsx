"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Vazio } from "@/components/vazio";
import type { Categoria } from "@/db/schema";
import { formatarReais } from "@/lib/dinheiro";
import { buscarMateriais } from "@/lib/normalizar";
import type { MaterialComSinonimos } from "@/server/dados/cadastros";
import { MaterialDialog } from "./material-dialog";

export function ListaMateriais({ materiais, categorias }: { materiais: MaterialComSinonimos[]; categorias: Categoria[] }) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas");

  const filtrados = useMemo(() => {
    let lista = materiais.filter((m) => categoria === "todas" || m.categoriaId === Number(categoria));
    if (busca.trim()) {
      const ids = new Map(
        buscarMateriais(
          busca,
          lista.map((m) => ({ id: m.id, nomePadronizado: m.nomePadronizado, unidade: m.unidade, sinonimos: m.sinonimos })),
          50,
        ).map((r, i) => [r.id, i]),
      );
      lista = lista.filter((m) => ids.has(m.id)).sort((a, b) => ids.get(a.id)! - ids.get(b.id)!);
    }
    return lista;
  }, [materiais, busca, categoria]);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder='Buscar como no WhatsApp: "cp2", "ferro 3/8", "fio 2,5"…'
            className="pl-9"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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
        <Vazio titulo="Nenhum material encontrado" descricao="Cadastre o material ou adicione um sinônimo a um existente." className="m-4" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Material</TableHead>
              <TableHead className="w-14">Un.</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="hidden lg:table-cell">Sinônimos</TableHead>
              <TableHead className="text-right">Último preço</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Compras</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtrados.map((m) => (
              <TableRow key={m.id} className={m.ativo ? "" : "opacity-55"}>
                <TableCell className="font-medium">{m.nomePadronizado}</TableCell>
                <TableCell className="text-muted-foreground">{m.unidade}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{m.categoria}</TableCell>
                <TableCell className="hidden max-w-xs lg:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {m.sinonimos.slice(0, 4).map((s) => (
                      <Badge key={s} tom="contorno" className="font-normal">
                        {s}
                      </Badge>
                    ))}
                    {m.sinonimos.length > 4 && <span className="text-xs text-muted-foreground">+{m.sinonimos.length - 4}</span>}
                  </div>
                </TableCell>
                <TableCell className="tabular text-right font-medium">{formatarReais(m.ultimoPreco)}</TableCell>
                <TableCell className="tabular hidden text-right text-muted-foreground sm:table-cell">{m.compras}</TableCell>
                <TableCell>
                  <MaterialDialog material={m} categorias={categorias}>
                    <Button variant="ghost" size="xs">
                      Editar
                    </Button>
                  </MaterialDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
