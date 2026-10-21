"use client";

import { aoEnviar } from "@/lib/form";
import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { somarDias } from "@/lib/datas";
import { centavosParaTextoInput, formatarNumero, formatarReais, textoParaCentavos, totalItem } from "@/lib/dinheiro";
import { cn } from "@/lib/utils";
import { salvarPropostaAction } from "@/server/actions/requisicoes";

type Item = {
  id: number;
  material: string;
  unidade: string;
  quantidade: number;
  especificacao: string | null;
  ultimoPago: number | null;
};

type PropostaExistente = {
  freteCentavos: number;
  condicaoPagamento: string | null;
  descontoAVistaBp: number;
  prazoEntregaDias: number | null;
  prazoObservacao: string | null;
  impostosInclusos: boolean;
  numeroOrcamento: string | null;
  vendedor: string | null;
  validade: string | null;
  dataCotacao: string;
  observacoes: string | null;
  totalDocumentoCentavos?: number | null;
  descontoNegociadoCentavos?: number;
  itens: {
    requisicaoItemId: number;
    precoUnitarioCentavos: number;
    totalCentavos?: number | null;
    quantidadeCotada?: number | null;
    unidadeCotada?: string | null;
    marca: string | null;
    disponivel: boolean;
  }[];
} | null;

/** Valor da linha: o total digitado (como no orçamento) ou preço × quantidade. */
function valorLinha(quantidade: number, p: { preco: string; total: string }) {
  const t = textoParaCentavos(p.total);
  if (t != null) return t;
  const c = textoParaCentavos(p.preco);
  return c != null ? totalItem(quantidade, c) : null;
}

const CONDICOES = ["À vista", "15 dias", "28 dias", "30 dias", "28/56 dias", "30/60 dias", "30/60/90 dias"];

export function FormProposta({
  hoje,
  requisicao,
  fornecedores,
  fornecedorId,
  proposta,
}: {
  hoje: string;
  requisicao: { id: number; itens: Item[] };
  fornecedores: { id: number; nome: string; sugerido: boolean }[];
  fornecedorId: number | null;
  proposta: PropostaExistente;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pendente, iniciar] = useTransition();
  const [frete, setFrete] = useState(centavosParaTextoInput(proposta?.freteCentavos ?? 0));
  const [condicao, setCondicao] = useState(proposta?.condicaoPagamento ?? "");
  const [desconto, setDesconto] = useState(proposta?.descontoAVistaBp ? String(proposta.descontoAVistaBp / 100).replace(".", ",") : "");
  const [impostosInclusos, setImpostosInclusos] = useState(proposta?.impostosInclusos ?? true);
  const [totalDocumento, setTotalDocumento] = useState(
    proposta?.totalDocumentoCentavos != null ? centavosParaTextoInput(proposta.totalDocumentoCentavos) : "",
  );
  const [descontoNeg, setDescontoNeg] = useState(proposta?.descontoNegociadoCentavos ?? 0);
  const [precos, setPrecos] = useState<Record<number, { preco: string; total: string; marca: string; disponivel: boolean }>>(() =>
    Object.fromEntries(
      requisicao.itens.map((i) => {
        const pi = proposta?.itens.find((x) => x.requisicaoItemId === i.id);
        return [
          i.id,
          {
            preco: pi ? centavosParaTextoInput(pi.precoUnitarioCentavos) : "",
            total: pi?.totalCentavos != null ? centavosParaTextoInput(pi.totalCentavos) : "",
            marca: pi?.marca ?? "",
            disponivel: pi?.disponivel ?? true,
          },
        ];
      }),
    ),
  );

  const totais = useMemo(() => {
    let subtotal = 0;
    let cotados = 0;
    for (const i of requisicao.itens) {
      const p = precos[i.id];
      const v = p.disponivel ? valorLinha(i.quantidade, p) : null;
      if (v != null) {
        subtotal += v;
        cotados += 1;
      }
    }
    const f = textoParaCentavos(frete) ?? 0;
    const bp = descontoParaBp(desconto);
    const negociado = Math.min(descontoNeg, subtotal);
    const totalAVista = bp > 0 ? Math.round(((subtotal - negociado) * (10000 - bp)) / 10000) + f : null;
    const doc = textoParaCentavos(totalDocumento);
    return {
      subtotal,
      frete: f,
      total: subtotal + f,
      negociado,
      final: subtotal + f - negociado,
      totalAVista,
      cotados,
      doc,
      diferenca: doc != null ? doc - (subtotal + f) : null,
    };
  }, [precos, frete, desconto, totalDocumento, descontoNeg, requisicao.itens]);

  function enviar(form: FormData) {
    if (!fornecedorId) return void toast.error("Escolha o fornecedor");
    const itens = requisicao.itens
      .map((i) => {
        const p = precos[i.id];
        const t = textoParaCentavos(p.total);
        const c = textoParaCentavos(p.preco) ?? (t != null ? Math.round(t / i.quantidade) : null);
        if (!p.disponivel) return { requisicaoItemId: i.id, precoUnitarioCentavos: c ?? 0, marca: p.marca, disponivel: false };
        if (c == null) return null;
        const original = proposta?.itens.find((x) => x.requisicaoItemId === i.id);
        return {
          requisicaoItemId: i.id,
          precoUnitarioCentavos: c,
          totalCentavos: t,
          // Mantém como veio no orçamento (ex.: 5,10 kg) enquanto o total da linha não mudar.
          quantidadeCotada: t != null && t === original?.totalCentavos ? original.quantidadeCotada : null,
          unidadeCotada: t != null && t === original?.totalCentavos ? original.unidadeCotada : null,
          marca: p.marca,
          disponivel: true,
        };
      })
      .filter((x) => x !== null);
    const prazo = String(form.get("prazo") ?? "").trim();
    iniciar(async () => {
      const r = await salvarPropostaAction({
        requisicaoId: requisicao.id,
        fornecedorId,
        freteCentavos: textoParaCentavos(frete) ?? 0,
        totalDocumentoCentavos: textoParaCentavos(totalDocumento),
        descontoNegociadoCentavos: totais.negociado,
        condicaoPagamento: condicao,
        descontoAVistaBp: descontoParaBp(desconto),
        prazoEntregaDias: prazo === "" ? null : Number(prazo),
        prazoObservacao: String(form.get("prazoObservacao") ?? ""),
        impostosInclusos,
        numeroOrcamento: String(form.get("numeroOrcamento") ?? ""),
        vendedor: String(form.get("vendedor") ?? ""),
        validade: String(form.get("validade") ?? "") || null,
        dataCotacao: String(form.get("dataCotacao") ?? hoje),
        observacoes: String(form.get("observacoes") ?? ""),
        itens,
      });
      if (!r.ok) return void toast.error(r.erro);
      toast.success("Proposta salva");
      router.push(`/requisicoes/${requisicao.id}/mapa`);
    });
  }

  const sugeridos = fornecedores.filter((f) => f.sugerido);
  const outros = fornecedores.filter((f) => !f.sugerido);

  return (
    <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-5">
          <Campo rotulo="Fornecedor" dica={proposta ? "Já existe proposta deste fornecedor: salvar substitui os valores." : undefined}>
            <Select value={fornecedorId ? String(fornecedorId) : ""} onValueChange={(v) => router.replace(`${pathname}?fornecedor=${v}`)}>
              <SelectTrigger autoFocus={!fornecedorId}>
                <SelectValue placeholder="Escolha o fornecedor…" />
              </SelectTrigger>
              <SelectContent>
                {sugeridos.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Atendem estas categorias</SelectLabel>
                    {sugeridos.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {outros.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Outros</SelectLabel>
                    {outros.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </Campo>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <Campo rotulo="Data da cotação" htmlFor="dataCotacao">
              <Input id="dataCotacao" name="dataCotacao" type="date" defaultValue={proposta?.dataCotacao ?? hoje} required />
            </Campo>
            <Campo rotulo="Total do PDF (R$)" htmlFor="totalDocumento" dica="Para conferir: o total impresso no orçamento original.">
              <Input
                id="totalDocumento"
                inputMode="decimal"
                value={totalDocumento}
                onChange={(e) => setTotalDocumento(e.target.value)}
                className="tabular text-right"
                placeholder="0,00"
              />
            </Campo>
            <Campo rotulo="Frete (R$)" htmlFor="frete">
              <Input id="frete" inputMode="decimal" value={frete} onChange={(e) => setFrete(e.target.value)} className="tabular text-right" placeholder="0,00" />
            </Campo>
            <Campo rotulo="Prazo (dias)" htmlFor="prazo" dica="0 = mesmo dia">
              <Input id="prazo" name="prazo" type="number" min={0} defaultValue={proposta?.prazoEntregaDias ?? ""} className="tabular" />
            </Campo>
            <Campo rotulo="Pagamento" htmlFor="condicao">
              <Input id="condicao" list="condicoes" value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="28 dias" />
              <datalist id="condicoes">
                {CONDICOES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Validade" htmlFor="validade">
              <Input id="validade" name="validade" type="date" defaultValue={proposta?.validade ?? somarDias(hoje, 7)} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-[1fr_1fr_1.3fr_120px]">
            <Campo rotulo="Nº orçamento / pedido" htmlFor="numeroOrcamento">
              <Input id="numeroOrcamento" name="numeroOrcamento" defaultValue={proposta?.numeroOrcamento ?? ""} placeholder="ex.: 7158073" />
            </Campo>
            <Campo rotulo="Vendedor / representante" htmlFor="vendedor">
              <Input id="vendedor" name="vendedor" defaultValue={proposta?.vendedor ?? ""} />
            </Campo>
            <Campo rotulo="Prazo conta a partir de" htmlFor="prazoObservacao">
              <Input
                id="prazoObservacao"
                name="prazoObservacao"
                list="bases-prazo"
                defaultValue={proposta?.prazoObservacao ?? ""}
                placeholder="após faturamento"
              />
              <datalist id="bases-prazo">
                {["após o pedido", "após faturamento", "após liberação do crédito", "após pagamento antecipado"].map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Campo>
            <Campo rotulo="Desc. à vista (%)" htmlFor="desconto">
              <Input id="desconto" inputMode="decimal" value={desconto} onChange={(e) => setDesconto(e.target.value)} className="tabular text-right" placeholder="0" />
            </Campo>
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-[13px]">
            <Checkbox checked={!impostosInclusos} onCheckedChange={(v) => setImpostosInclusos(!v)} />
            Preços <strong className="font-medium">sem IPI</strong> / impostos destacados à parte
          </label>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle>Preços</CardTitle>
          <span className="text-xs text-muted-foreground">
            {totais.cotados}/{requisicao.itens.length} cotados
          </span>
        </CardHeader>
        <div className="divide-y">
          {requisicao.itens.map((i, idx) => {
            const p = precos[i.id];
            const c = textoParaCentavos(p.preco);
            const variacao = c != null && i.ultimoPago ? c / i.ultimoPago - 1 : null;
            const set = (parcial: Partial<typeof p>) => setPrecos((s) => ({ ...s, [i.id]: { ...s[i.id], ...parcial } }));
            return (
              <div key={i.id} className={cn("grid gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_130px_120px_110px] sm:items-center", !p.disponivel && "opacity-60")}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-medium">{i.material}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatarNumero(i.quantidade)} {i.unidade}
                    {i.ultimoPago != null && <> · último pago {formatarReais(i.ultimoPago)}</>}
                  </div>
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                  <Input
                    aria-label={`Preço unitário de ${i.material}`}
                    inputMode="decimal"
                    value={p.preco}
                    disabled={!p.disponivel}
                    onChange={(e) => set({ preco: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (document.querySelectorAll<HTMLInputElement>("[data-preco]")[idx + 1] ?? document.getElementById("frete"))?.focus();
                      }
                    }}
                    data-preco
                    autoFocus={!!fornecedorId && idx === 0}
                    className="tabular pl-9 text-right"
                    placeholder="0,00"
                  />
                </div>
                <div className="tabular text-right text-[13px]">
                  <Input
                    aria-label={`Total da linha de ${i.material} (como no orçamento)`}
                    title="Total da linha como está no orçamento. Use quando o fornecedor cotou em outra unidade (kg, peça, rolo)."
                    inputMode="decimal"
                    value={p.total}
                    disabled={!p.disponivel}
                    onChange={(e) => set({ total: e.target.value })}
                    placeholder={c != null && p.disponivel ? centavosParaTextoInput(totalItem(i.quantidade, c)) : "total"}
                    className={cn("tabular h-8 text-right text-[13px]", p.total && "border-primary/60 font-medium")}
                  />
                  {variacao != null && Math.abs(variacao) >= 0.005 && (
                    <div className={cn("text-[11px] font-medium", variacao > 0 ? "text-st-urgente" : "text-st-ok")}>
                      {variacao > 0 ? "▲" : "▼"} {Math.abs(variacao * 100).toFixed(1).replace(".", ",")}% vs último
                    </div>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:justify-end">
                  <Checkbox checked={!p.disponivel} onCheckedChange={(v) => set({ disponivel: !v })} />
                  Não tem
                </label>
              </div>
            );
          })}
        </div>
        <div className="grid gap-1 border-t bg-muted/40 px-5 py-3 text-[13px]">
          <Linha rotulo="Subtotal" valor={formatarReais(totais.subtotal)} />
          <Linha rotulo="Frete" valor={formatarReais(totais.frete)} />
          {totais.diferenca != null && (
            <div
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium",
                totais.diferenca === 0 ? "bg-st-ok-bg text-st-ok" : "bg-st-urgente-bg text-st-urgente",
              )}
            >
              {totais.diferenca === 0
                ? `✓ Confere centavo a centavo com o orçamento (${formatarReais(totais.doc!)})`
                : `Não bate com o orçamento (${formatarReais(totais.doc!)}): diferença de ${formatarReais(totais.diferenca)}. Confira frete e o total de cada linha.`}
            </div>
          )}
          <Linha rotulo={totais.negociado ? "Total do orçamento" : "Total"} valor={formatarReais(totais.total)} forte={!totais.negociado} />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-card px-3 py-2">
            <div>
              <div className="text-[13px] font-medium">Total final negociado</div>
              <div className="text-xs text-muted-foreground">Conseguiu desconto depois do orçamento? Digite o valor fechado.</div>
            </div>
            <div className="relative w-40">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
              <Input
                key={`${totais.total}-${descontoNeg}`}
                aria-label="Total final negociado"
                inputMode="decimal"
                defaultValue={descontoNeg ? centavosParaTextoInput(totais.final) : ""}
                placeholder={centavosParaTextoInput(totais.total)}
                onBlur={(e) => {
                  const v = textoParaCentavos(e.target.value);
                  if (v == null) return setDescontoNeg(0);
                  if (v > totais.total) {
                    toast.error("O total negociado não pode ser maior que o do orçamento");
                    return setDescontoNeg(0);
                  }
                  if (v < totais.frete) return void toast.error("O total negociado ficou menor que o frete. Confira o valor.");
                  setDescontoNeg(totais.total - v);
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
                className="tabular h-9 pl-9 text-right font-semibold"
              />
            </div>
          </div>
          {totais.negociado > 0 && (
            <>
              <Linha
                rotulo={`Desconto negociado (${((totais.negociado / totais.subtotal) * 100).toFixed(2).replace(".", ",")}%)`}
                valor={`−${formatarReais(totais.negociado)}`}
              />
              <Linha rotulo="Total final" valor={formatarReais(totais.final)} forte />
            </>
          )}
          {totais.totalAVista != null && <Linha rotulo="À vista (desconto sobre itens)" valor={formatarReais(totais.totalAVista)} />}
        </div>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Campo rotulo="Observações da proposta" htmlFor="observacoes">
            <Input id="observacoes" name="observacoes" defaultValue={proposta?.observacoes ?? ""} placeholder="Marca, condições especiais, frete grátis acima de…" />
          </Campo>
        </CardContent>
      </Card>

      <div className="sticky bottom-16 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" size="lg" disabled={pendente || !fornecedorId}>
          {pendente ? "Salvando…" : "Salvar e ver mapa"}
        </Button>
      </div>
    </form>
  );
}

/** "4,3" → 430 (centésimos de %). */
function descontoParaBp(texto: string): number {
  const n = Number(texto.trim().replace("%", "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

function Linha({ rotulo, valor, forte }: { rotulo: string; valor: string; forte?: boolean }) {
  return (
    <div className={cn("flex justify-between", forte && "text-[15px] font-semibold")}>
      <span className={forte ? "" : "text-muted-foreground"}>{rotulo}</span>
      <span className="tabular">{valor}</span>
    </div>
  );
}
