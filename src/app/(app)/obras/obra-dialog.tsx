"use client";

import { aoEnviar } from "@/lib/form";
import { useState, useTransition } from "react";
import { Trash2Icon } from "lucide-react";
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
import { excluirObraAction, salvarObraAction } from "@/server/actions/cadastros";
import type { StatusObra } from "@/db/schema";
import { formatarCnpj } from "@/lib/normalizar";

type ObraForm = {
  id?: number;
  nome: string;
  endereco: string | null;
  cep: string | null;
  engenheiroResponsavel: string | null;
  status: StatusObra;
  razaoSocial: string | null;
  cnpj: string | null;
  cno: string | null;
};

export function ObraDialog({ obra, children }: { obra?: ObraForm; children: React.ReactNode }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [status, setStatus] = useState<StatusObra>(obra?.status ?? "ativa");

  function excluir() {
    if (!obra?.id || !confirm(`Excluir a obra "${obra.nome}"? Não dá para desfazer.`)) return;
    const id = obra.id;
    iniciar(async () => {
      const r = await excluirObraAction(id);
      if (!r.ok) return void toast.error(r.erro, { duration: 8000 });
      toast.success("Obra excluída");
      setAberto(false);
    });
  }

  function enviar(form: FormData) {
    iniciar(async () => {
      const r = await salvarObraAction(
        {
          nome: String(form.get("nome") ?? ""),
          endereco: String(form.get("endereco") ?? ""),
          cep: String(form.get("cep") ?? ""),
          engenheiroResponsavel: String(form.get("engenheiro") ?? ""),
          status,
          razaoSocial: String(form.get("razaoSocial") ?? ""),
          cnpj: String(form.get("cnpj") ?? ""),
          cno: String(form.get("cno") ?? ""),
        },
        obra?.id,
      );
      if (!r.ok) return void toast.error(r.erro);
      toast.success(obra ? "Obra atualizada" : "Obra cadastrada");
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{obra ? "Editar obra" : "Nova obra"}</DialogTitle>
          <DialogDescription>Os dados de faturamento vão nas mensagens de cotação e no pedido de compra.</DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
          <Campo rotulo="Nome da obra" htmlFor="nome">
            <Input id="nome" name="nome" defaultValue={obra?.nome} required autoFocus />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-[1fr_130px]">
            <Campo rotulo="Endereço de entrega" htmlFor="endereco">
              <Input id="endereco" name="endereco" defaultValue={obra?.endereco ?? ""} />
            </Campo>
            <Campo rotulo="CEP" htmlFor="cep">
              <Input id="cep" name="cep" inputMode="numeric" defaultValue={obra?.cep ?? ""} />
            </Campo>
          </div>
          <fieldset className="grid gap-4 rounded-lg border p-3">
            <legend className="px-1 text-[12px] font-medium text-muted-foreground">Faturamento (ficha cadastral)</legend>
            <Campo rotulo="Razão social" htmlFor="razaoSocial" dica="Deixe vazio para usar a razão social da empresa.">
              <Input id="razaoSocial" name="razaoSocial" defaultValue={obra?.razaoSocial ?? ""} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="CNPJ da obra" htmlFor="cnpj">
                <Input id="cnpj" name="cnpj" inputMode="numeric" defaultValue={formatarCnpj(obra?.cnpj)} placeholder="00.000.000/0000-00" />
              </Campo>
              <Campo rotulo="CNO" htmlFor="cno">
                <Input id="cno" name="cno" defaultValue={obra?.cno ?? ""} placeholder="00.000.00000/00" />
              </Campo>
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Engenheiro responsável" htmlFor="engenheiro">
              <Input id="engenheiro" name="engenheiro" defaultValue={obra?.engenheiroResponsavel ?? ""} />
            </Campo>
            <Campo rotulo="Status">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusObra)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="concluida">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </Campo>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {obra ? (
              <Button type="button" variant="ghost" className="text-muted-foreground hover:text-st-urgente" onClick={excluir} disabled={pendente}>
                <Trash2Icon /> Excluir obra
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar"}
            </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
