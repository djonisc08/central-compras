"use client";

import { aoEnviar } from "@/lib/form";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlameIcon, MessageSquareTextIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { MaterialCombobox, type OpcaoMaterial } from "@/components/material-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Categoria } from "@/db/schema";
import { diasEntre, somarDias } from "@/lib/datas";
import { cn } from "@/lib/utils";
import { criarRequisicaoAction } from "@/server/actions/requisicoes";
import { MaterialDialog } from "../../materiais/material-dialog";

type Linha = { chave: number; materialId: number | null; quantidade: string; especificacao: string };

let seq = 1;
const novaLinha = (): Linha => ({ chave: seq++, materialId: null, quantidade: "", especificacao: "" });

export function FormRequisicao({
  hoje,
  obras,
  materiais,
  categorias,
}: {
  hoje: string;
  obras: { id: number; nome: string; status: string }[];
  materiais: OpcaoMaterial[];
  categorias: Categoria[];
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [obraId, setObraId] = useState("");
  const [dataPedido, setDataPedido] = useState(hoje);
  const [dataNecessidade, setDataNecessidade] = useState(somarDias(hoje, 3));
  const [urgente, setUrgente] = useState(false);
  const [urgenteManual, setUrgenteManual] = useState(false);
  const [mostrarOrigem, setMostrarOrigem] = useState(false);
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [criandoPara, setCriandoPara] = useState<{ chave: number; texto: string } | null>(null);
  const gatilhos = useRef(new Map<number, HTMLButtonElement | null>());
  const gatilhoNovo = useRef<HTMLButtonElement>(null);

  function mudarNecessidade(v: string) {
    setDataNecessidade(v);
    if (!urgenteManual) setUrgente(diasEntre(dataPedido, v) <= 1);
  }

  function atualizar(chave: number, parcial: Partial<Linha>) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)));
  }

  function adicionarLinha() {
    const l = novaLinha();
    setLinhas((ls) => [...ls, l]);
    setTimeout(() => gatilhos.current.get(l.chave)?.click(), 30);
  }

  function enviar(form: FormData) {
    const itens = linhas
      .filter((l) => l.materialId || l.quantidade)
      .map((l) => ({
        materialId: l.materialId as number,
        quantidade: Number(l.quantidade.replace(",", ".")),
        especificacao: l.especificacao,
      }));
    iniciar(async () => {
      const r = await criarRequisicaoAction({
        obraId: Number(obraId) || (undefined as unknown as number),
        solicitante: String(form.get("solicitante") ?? ""),
        dataPedido,
        dataNecessidade,
        urgente,
        origemTexto: String(form.get("origem") ?? ""),
        observacoes: String(form.get("observacoes") ?? ""),
        itens,
      });
      if (!r.ok) return void toast.error(r.erro);
      toast.success(`Requisição #${r.dados} criada`);
      router.push(`/requisicoes/${r.dados}`);
    });
  }

  const porId = new Map(materiais.map((m) => [m.id, m]));

  return (
    <>
    <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Obra">
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger autoFocus>
                  <SelectValue placeholder="Escolha a obra…" />
                </SelectTrigger>
                <SelectContent>
                  {obras.map((o) => (
                    <SelectItem key={o.id} value={String(o.id)}>
                      {o.nome}
                      {o.status === "planejada" && <span className="text-muted-foreground"> · planejada</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo rotulo="Solicitante" htmlFor="solicitante">
              <Input id="solicitante" name="solicitante" placeholder="Quem pediu (mestre, engenheiro…)" required />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <Campo rotulo="Data do pedido" htmlFor="dataPedido">
              <Input id="dataPedido" type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} required />
            </Campo>
            <Campo rotulo="Precisa na obra até" htmlFor="dataNecessidade">
              <Input id="dataNecessidade" type="date" value={dataNecessidade} min={dataPedido} onChange={(e) => mudarNecessidade(e.target.value)} required />
            </Campo>
            <div className="col-span-2 flex items-end sm:col-span-1">
              <label
                className={cn(
                  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 text-[13px] font-medium transition-colors",
                  urgente ? "border-st-urgente/40 bg-st-urgente-bg text-st-urgente" : "text-muted-foreground",
                )}
              >
                <Switch
                  checked={urgente}
                  onCheckedChange={(v) => {
                    setUrgente(v);
                    setUrgenteManual(true);
                  }}
                />
                <FlameIcon className="size-4" /> Urgente
              </label>
            </div>
          </div>
          {!mostrarOrigem ? (
            <button
              type="button"
              onClick={() => setMostrarOrigem(true)}
              className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-[13px] text-primary hover:underline"
            >
              <MessageSquareTextIcon className="size-4" /> Colar a mensagem original do WhatsApp
            </button>
          ) : (
            <Campo rotulo="Mensagem original (WhatsApp)" htmlFor="origem" dica="Fica guardada para consulta. Para leitura automática, use a skill nova-requisicao.">
              <Textarea id="origem" name="origem" rows={3} autoFocus />
            </Campo>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Itens</CardTitle>
          <span className="text-xs text-muted-foreground">{linhas.filter((l) => l.materialId).length} itens</span>
        </CardHeader>
        <CardContent className="grid gap-2">
          <div className="hidden grid-cols-[minmax(0,1fr)_110px_minmax(0,0.7fr)_36px] gap-2 px-0.5 text-[11.5px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
            <span>Material</span>
            <span>Quantidade</span>
            <span>Especificação / observação</span>
            <span />
          </div>
          {linhas.map((l, idx) => {
            const m = l.materialId ? porId.get(l.materialId) : undefined;
            return (
              <div
                key={l.chave}
                className="grid grid-cols-[minmax(0,1fr)_96px_36px] gap-2 rounded-lg border p-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,0.7fr)_36px] sm:border-0 sm:p-0"
              >
                <MaterialCombobox
                  ref={(el) => {
                    gatilhos.current.set(l.chave, el);
                  }}
                  materiais={materiais}
                  valor={l.materialId}
                  aoMudar={(id) => {
                    atualizar(l.chave, { materialId: id });
                    setTimeout(() => document.getElementById(`qtd-${l.chave}`)?.focus(), 30);
                  }}
                  aoCriar={(texto) => {
                    setCriandoPara({ chave: l.chave, texto });
                    setTimeout(() => gatilhoNovo.current?.click(), 10);
                  }}
                  className="col-span-3 sm:col-span-1"
                />
                <div className="relative col-start-1 row-start-2 sm:col-start-auto sm:row-start-auto">
                  <Input
                    id={`qtd-${l.chave}`}
                    inputMode="decimal"
                    value={l.quantidade}
                    onChange={(e) => atualizar(l.chave, { quantidade: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (idx === linhas.length - 1) adicionarLinha();
                        else gatilhos.current.get(linhas[idx + 1].chave)?.focus();
                      }
                    }}
                    placeholder="0"
                    className="tabular pr-10 text-right"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{m?.unidade}</span>
                </div>
                <Input
                  value={l.especificacao}
                  onChange={(e) => atualizar(l.chave, { especificacao: e.target.value })}
                  placeholder="Opcional"
                  className="col-start-2 row-start-2 sm:col-start-auto sm:row-start-auto"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="row-start-2 text-muted-foreground hover:text-destructive sm:row-start-auto"
                  onClick={() => setLinhas((ls) => (ls.length > 1 ? ls.filter((x) => x.chave !== l.chave) : [novaLinha()]))}
                  aria-label="Remover item"
                >
                  <Trash2Icon />
                </Button>
              </div>
            );
          })}
          <Button type="button" variant="outline" size="sm" className="mt-1 w-fit" onClick={adicionarLinha}>
            <PlusIcon /> Adicionar item
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <Campo rotulo="Observações" htmlFor="observacoes">
            <Textarea id="observacoes" name="observacoes" rows={2} placeholder="Local de descarga, horário, contato na obra…" />
          </Campo>
        </CardContent>
      </Card>

      <div className="sticky bottom-16 z-10 -mx-4 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 lg:bottom-0">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendente} size="lg">
          {pendente ? "Salvando…" : "Criar requisição"}
        </Button>
      </div>
    </form>

      <MaterialDialog
        key={criandoPara?.chave ?? 0}
        categorias={categorias}
        inicial={{ nome: criandoPara?.texto }}
        aoSalvar={(id) => {
          if (criandoPara) atualizar(criandoPara.chave, { materialId: id });
          setCriandoPara(null);
        }}
      >
        <button ref={gatilhoNovo} type="button" className="hidden" aria-hidden tabIndex={-1} />
      </MaterialDialog>
    </>
  );
}
