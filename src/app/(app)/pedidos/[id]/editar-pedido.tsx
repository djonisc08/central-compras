"use client";

import { useState, useTransition } from "react";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { aoEnviar } from "@/lib/form";
import { formatarCnpj } from "@/lib/normalizar";
import { editarPedidoAction } from "@/server/actions/pedidos";

export type DadosEdicaoPedido = {
  id: number;
  numero: string | null;
  condicaoPagamento: string | null;
  aprovadoPor: string | null;
  dataAprovacao: string | null;
  dataEmissao: string | null;
  prazoPrometido: string | null;
  observacoes: string | null;
  /** Faturamento em uso (corrigido no pedido ou da ficha da obra). */
  razaoSocial: string | null;
  cnpj: string | null;
  cno: string | null;
  endereco: string | null;
  cep: string | null;
};

/** Corrigir os dados do pedido depois de gerado: o financeiro pediu outro CNPJ, o prazo mudou etc. */
export function EditarPedido({ pedido }: { pedido: DadosEdicaoPedido }) {
  const [aberto, setAberto] = useState(false);
  const [pendente, iniciar] = useTransition();
  const texto = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

  function salvar(f: FormData) {
    iniciar(async () => {
      const r = await editarPedidoAction(pedido.id, {
        condicaoPagamento: texto(f, "condicaoPagamento"),
        aprovadoPor: texto(f, "aprovadoPor"),
        dataAprovacao: texto(f, "dataAprovacao") || null,
        dataEmissao: texto(f, "dataEmissao") || null,
        prazoPrometido: texto(f, "prazoPrometido") || null,
        observacoes: texto(f, "observacoes"),
        fatRazaoSocial: texto(f, "fatRazaoSocial"),
        fatCnpj: texto(f, "fatCnpj"),
        fatCno: texto(f, "fatCno"),
        fatEndereco: texto(f, "fatEndereco"),
        fatCep: texto(f, "fatCep"),
      });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`${pedido.numero ?? "Pedido"} atualizado`);
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full">
          <PencilIcon /> Editar dados do pedido
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {pedido.numero ?? "pedido"}</DialogTitle>
          <DialogDescription>
            Corrige só este pedido (PDF, resumo do financeiro e relatórios). A ficha da obra não muda. Itens e valores ficam como fechados.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar(salvar)} className="grid gap-4">
          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Faturamento</legend>
            <Campo rotulo="Razão social" htmlFor="fatRazaoSocial">
              <Input id="fatRazaoSocial" name="fatRazaoSocial" defaultValue={pedido.razaoSocial ?? ""} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="CNPJ" htmlFor="fatCnpj">
                <Input id="fatCnpj" name="fatCnpj" defaultValue={pedido.cnpj ? formatarCnpj(pedido.cnpj) : ""} className="tabular" />
              </Campo>
              <Campo rotulo="CNO" htmlFor="fatCno">
                <Input id="fatCno" name="fatCno" defaultValue={pedido.cno ?? ""} className="tabular" />
              </Campo>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
              <Campo rotulo="Endereço de entrega" htmlFor="fatEndereco">
                <Input id="fatEndereco" name="fatEndereco" defaultValue={pedido.endereco ?? ""} />
              </Campo>
              <Campo rotulo="CEP" htmlFor="fatCep">
                <Input id="fatCep" name="fatCep" defaultValue={pedido.cep ?? ""} className="tabular" />
              </Campo>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Condição de pagamento" htmlFor="condicaoPagamento">
              <Input id="condicaoPagamento" name="condicaoPagamento" defaultValue={pedido.condicaoPagamento ?? ""} />
            </Campo>
            <Campo rotulo="Aprovado por" htmlFor="aprovadoPor">
              <Input id="aprovadoPor" name="aprovadoPor" defaultValue={pedido.aprovadoPor ?? ""} />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Data da aprovação" htmlFor="dataAprovacao">
              <Input id="dataAprovacao" name="dataAprovacao" type="date" defaultValue={pedido.dataAprovacao ?? ""} />
            </Campo>
            <Campo rotulo="Data da emissão" htmlFor="dataEmissao">
              <Input id="dataEmissao" name="dataEmissao" type="date" defaultValue={pedido.dataEmissao ?? ""} />
            </Campo>
            <Campo rotulo="Entrega prometida" htmlFor="prazoPrometido">
              <Input id="prazoPrometido" name="prazoPrometido" type="date" defaultValue={pedido.prazoPrometido ?? ""} />
            </Campo>
          </div>
          <Campo rotulo="Observações" htmlFor="observacoesPedido">
            <Textarea id="observacoesPedido" name="observacoes" rows={2} defaultValue={pedido.observacoes ?? ""} />
          </Campo>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar correções"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
