"use client";

import { aoEnviar } from "@/lib/form";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Categoria } from "@/db/schema";
import { formatarCnpj, formatarWhatsapp } from "@/lib/normalizar";
import { salvarFornecedorAction } from "@/server/actions/cadastros";
import type { FornecedorComCategorias } from "@/server/dados/cadastros";

export function FornecedorDialog({
  fornecedor,
  categorias,
  children,
}: {
  fornecedor?: FornecedorComCategorias;
  categorias: Categoria[];
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [cats, setCats] = useState<number[]>(fornecedor?.categoriaIds ?? []);
  const [ativo, setAtivo] = useState(fornecedor?.ativo ?? true);

  function enviar(form: FormData) {
    const v = (k: string) => String(form.get(k) ?? "");
    iniciar(async () => {
      const r = await salvarFornecedorAction(
        {
          nome: v("nome"),
          cnpj: v("cnpj"),
          contato: v("contato"),
          whatsapp: v("whatsapp"),
          email: v("email"),
          cidade: v("cidade"),
          observacoes: v("observacoes"),
          ativo,
          categoriaIds: cats,
        },
        fornecedor?.id,
      );
      if (!r.ok) return void toast.error(r.erro);
      toast.success(fornecedor ? "Fornecedor atualizado" : "Fornecedor cadastrado");
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{fornecedor ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>As categorias definem para quem a mensagem de cotação é enviada.</DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
            <Campo rotulo="Nome / razão social" htmlFor="nome">
              <Input id="nome" name="nome" defaultValue={fornecedor?.nome} required autoFocus />
            </Campo>
            <Campo rotulo="CNPJ" htmlFor="cnpj">
              <Input id="cnpj" name="cnpj" inputMode="numeric" defaultValue={formatarCnpj(fornecedor?.cnpj)} placeholder="00.000.000/0000-00" />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo rotulo="Contato" htmlFor="contato">
              <Input id="contato" name="contato" defaultValue={fornecedor?.contato ?? ""} />
            </Campo>
            <Campo rotulo="WhatsApp" htmlFor="whatsapp">
              <Input id="whatsapp" name="whatsapp" inputMode="tel" defaultValue={formatarWhatsapp(fornecedor?.whatsapp)} placeholder="(47) 99999-0000" />
            </Campo>
            <Campo rotulo="Cidade" htmlFor="cidade">
              <Input id="cidade" name="cidade" defaultValue={fornecedor?.cidade ?? ""} />
            </Campo>
          </div>
          <Campo rotulo="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" defaultValue={fornecedor?.email ?? ""} />
          </Campo>
          <Campo rotulo="Categorias atendidas">
            <div className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-3">
              {categorias.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={cats.includes(c.id)}
                    onCheckedChange={(v) => setCats((atual) => (v ? [...atual, c.id] : atual.filter((x) => x !== c.id)))}
                  />
                  {c.nome}
                </label>
              ))}
            </div>
          </Campo>
          <Campo rotulo="Observações" htmlFor="observacoes">
            <Textarea id="observacoes" name="observacoes" rows={2} defaultValue={fornecedor?.observacoes ?? ""} />
          </Campo>
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={ativo} onCheckedChange={setAtivo} /> Fornecedor ativo
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
