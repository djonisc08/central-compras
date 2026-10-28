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
import { centavosParaTextoInput, formatarReais, textoParaCentavos } from "@/lib/dinheiro";
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
  /** Soma das linhas do pedido, sem descontos (centavos). */
  itensCentavos: number;
  freteCentavos: number;
  descontoNegociadoCentavos: number;
  /** Desconto à vista já aplicado (centésimos de %). */
  descontoBp: number;
  valorTotalCentavos: number;
};

/** Corrigir os dados do pedido depois de gerado: o financeiro pediu outro CNPJ, o prazo mudou etc. */
export function EditarPedido({ pedido, destaque }: { pedido: DadosEdicaoPedido; destaque?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [frete, setFrete] = useState(centavosParaTextoInput(pedido.freteCentavos));
  const [negociado, setNegociado] = useState(pedido.descontoNegociadoCentavos);
  const freteC = textoParaCentavos(frete) ?? 0;
  const liquido = pedido.itensCentavos - negociado;
  const total = (pedido.descontoBp > 0 ? Math.round((liquido * (10000 - pedido.descontoBp)) / 10000) : liquido) + freteC;
  /** Quem digita o total final: descobre o desconto que leva a esse total. */
  function definirTotalFinal(texto: string) {
    const alvo = textoParaCentavos(texto);
    if (alvo == null) return setNegociado(0);
    const semFrete = alvo - freteC;
    const itensAlvo = pedido.descontoBp > 0 ? Math.round((semFrete * 10000) / (10000 - pedido.descontoBp)) : semFrete;
    const d = pedido.itensCentavos - itensAlvo;
    if (d < 0) return void toast.error("O total final não pode ser maior que o valor dos itens + frete");
    if (d > pedido.itensCentavos) return void toast.error("Esse total ficou menor que o frete. Confira o valor.");
    setNegociado(d);
  }
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
        freteCentavos: freteC,
        descontoNegociadoCentavos: negociado,
      });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`${pedido.numero ?? "Pedido"} atualizado`);
      setAberto(false);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        {destaque ? (
          <Button variant="outline">
            <PencilIcon /> Editar pedido
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full">
            <PencilIcon /> Editar dados do pedido
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar {pedido.numero ?? "pedido"}</DialogTitle>
          <DialogDescription>
            Corrige só este pedido (PDF, resumo do financeiro e relatórios). A ficha da obra não muda. Conseguiu desconto? Ajuste em Valores.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={aoEnviar(salvar)} className="grid gap-4">
          <fieldset className="grid gap-3 rounded-lg border-2 border-marca-verde/50 p-3">
            <legend className="px-1 text-xs font-semibold tracking-wide text-marca-verde-escuro uppercase">Valores</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Frete (R$)" htmlFor="fretePedido">
                <Input id="fretePedido" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} className="tabular text-right" />
              </Campo>
              <Campo rotulo="Total final negociado (R$)" htmlFor="totalFinal" dica="Digite o valor fechado e aperte Enter: o desconto é calculado.">
                <Input
                  id="totalFinal"
                  key={`${negociado}-${freteC}`}
                  inputMode="decimal"
                  defaultValue={centavosParaTextoInput(total)}
                  onBlur={(e) => definirTotalFinal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
                  className="tabular text-right font-semibold"
                />
              </Campo>
            </div>
            <div className="grid gap-0.5 rounded-md bg-muted/50 px-3 py-2 text-[13px]">
              <Linha rotulo="Itens" valor={formatarReais(pedido.itensCentavos)} />
              {negociado > 0 && (
                <Linha
                  rotulo={`Desconto negociado (${((negociado / pedido.itensCentavos) * 100).toFixed(2).replace(".", ",")}%)`}
                  valor={`−${formatarReais(negociado)}`}
                  verde
                />
              )}
              {pedido.descontoBp > 0 && (
                <Linha rotulo={`Desconto à vista (${(pedido.descontoBp / 100).toLocaleString("pt-BR")}%)`} valor="aplicado" verde />
              )}
              <Linha rotulo="Frete" valor={freteC ? formatarReais(freteC) : "CIF"} />
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                <span>Total do pedido</span>
                <span className="tabular">
                  {formatarReais(total)}
                  {total !== pedido.valorTotalCentavos && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground line-through">{formatarReais(pedido.valorTotalCentavos)}</span>
                  )}
                </span>
              </div>
            </div>
          </fieldset>
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

function Linha({ rotulo, valor, verde }: { rotulo: string; valor: string; verde?: boolean }) {
  return (
    <div className={`flex justify-between ${verde ? "text-st-ok" : "text-muted-foreground"}`}>
      <span>{rotulo}</span>
      <span className="tabular">{valor}</span>
    </div>
  );
}
