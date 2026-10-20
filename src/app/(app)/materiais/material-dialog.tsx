"use client";

import { aoEnviar } from "@/lib/form";
import { useState, useTransition } from "react";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UNIDADES, type Categoria } from "@/db/schema";
import { salvarMaterialAction } from "@/server/actions/cadastros";

type MaterialForm = {
  id: number;
  nomePadronizado: string;
  unidade: string;
  categoriaId: number;
  ativo: boolean;
  sinonimos: string[];
};

export function MaterialDialog({
  material,
  categorias,
  inicial,
  aoSalvar,
  children,
}: {
  material?: MaterialForm;
  categorias: Categoria[];
  inicial?: { nome?: string };
  aoSalvar?: (id: number) => void;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [unidade, setUnidade] = useState(material?.unidade ?? "un");
  const [categoriaId, setCategoriaId] = useState(material?.categoriaId ? String(material.categoriaId) : "");
  const [ativo, setAtivo] = useState(material?.ativo ?? true);
  const [sinonimos, setSinonimos] = useState<string[]>(material?.sinonimos ?? []);
  const [novoSin, setNovoSin] = useState("");

  function addSinonimo() {
    const s = novoSin.trim();
    if (s && !sinonimos.includes(s)) setSinonimos([...sinonimos, s]);
    setNovoSin("");
  }

  function enviar(form: FormData) {
    iniciar(async () => {
      const pendenteSin = novoSin.trim();
      const r = await salvarMaterialAction(
        {
          nomePadronizado: String(form.get("nome") ?? ""),
          unidade,
          categoriaId: Number(categoriaId) || (undefined as unknown as number),
          ativo,
          sinonimos: pendenteSin ? [...sinonimos, pendenteSin] : sinonimos,
        },
        material?.id,
      );
      if (!r.ok) return void toast.error(r.erro);
      toast.success(material ? "Material atualizado" : "Material cadastrado");
      setAberto(false);
      aoSalvar?.(r.dados);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{material ? "Editar material" : "Novo material"}</DialogTitle>
          <DialogDescription>
            Use um nome padronizado e completo (ex.: “Cimento CPII-E 32 50kg”). Apelidos da obra vão em sinônimos.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
          <Campo rotulo="Nome padronizado" htmlFor="nome">
            <Input id="nome" name="nome" defaultValue={material?.nomePadronizado ?? inicial?.nome} required autoFocus />
          </Campo>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <Campo rotulo="Unidade">
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Categoria">
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha…" />
                </SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <Campo rotulo="Sinônimos" dica="Como a obra costuma escrever. Enter para adicionar.">
            <div className="flex gap-2">
              <Input
                value={novoSin}
                onChange={(e) => setNovoSin(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSinonimo();
                  }
                }}
                placeholder='ex.: "CP2 50kg"'
              />
              <Button type="button" variant="outline" onClick={addSinonimo}>
                Adicionar
              </Button>
            </div>
            {sinonimos.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {sinonimos.map((s) => (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-2.5 text-xs">
                    {s}
                    <button
                      type="button"
                      className="cursor-pointer rounded-full p-0.5 hover:bg-muted"
                      onClick={() => setSinonimos(sinonimos.filter((x) => x !== s))}
                      aria-label={`Remover ${s}`}
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Campo>
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={ativo} onCheckedChange={setAtivo} /> Material ativo
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
