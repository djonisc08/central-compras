"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckCircle2Icon, ClipboardPasteIcon, FlameIcon, PlusIcon, SparklesIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { toast } from "sonner";
import { Campo } from "@/components/campo";
import { MaterialCombobox, type OpcaoMaterial } from "@/components/material-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UNIDADES, type Categoria } from "@/db/schema";
import { diasEntre, formatarData, somarDias } from "@/lib/datas";
import { aoEnviar } from "@/lib/form";
import { interpretarPedido, type ObraContexto } from "@/lib/interpretar-pedido";
import { cn } from "@/lib/utils";
import { criarRequisicaoCompletaAction } from "@/server/actions/requisicoes";

type NovoMaterial = { nome: string; unidade: string; categoria: string };
type Linha = {
  chave: number;
  materialId: number | null;
  novo: NovoMaterial | null;
  quantidade: string;
  especificacao: string;
  textoOriginal: string | null;
  /** Vindo do "colar pedido": o que o sistema achou do item. */
  situacao?: "catalogo" | "confirmar" | "novo";
  aviso?: string | null;
  candidatos?: { id: number; nomePadronizado: string; unidade: string }[];
  sugestao?: NovoMaterial;
};

let seq = 1;
const novaLinha = (): Linha => ({ chave: seq++, materialId: null, novo: null, quantidade: "", especificacao: "", textoOriginal: null });

export function FormRequisicao({
  hoje,
  obras,
  materiais,
  categorias,
  abrirColar,
}: {
  hoje: string;
  obras: (ObraContexto & { status: string })[];
  materiais: OpcaoMaterial[];
  categorias: Categoria[];
  abrirColar?: boolean;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [obraId, setObraId] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [dataPedido, setDataPedido] = useState(hoje);
  const [dataNecessidade, setDataNecessidade] = useState(somarDias(hoje, 3));
  const [urgente, setUrgente] = useState(false);
  const [urgenteManual, setUrgenteManual] = useState(false);
  const [origem, setOrigem] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([novaLinha()]);
  const [colado, setColado] = useState("");
  const [alertas, setAlertas] = useState<string[]>([]);
  const [interpretado, setInterpretado] = useState<string | null>(null);
  const gatilhos = useRef(new Map<number, HTMLButtonElement | null>());
  const areaColar = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (abrirColar) areaColar.current?.focus();
  }, [abrirColar]);

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

  // ------------------------------------------------------------ colar pedido
  function interpretar() {
    if (!colado.trim()) return void toast.error("Cole a mensagem do WhatsApp primeiro");
    const r = interpretarPedido(colado, { obras, catalogo: materiais }, hoje);
    if (r.obraId) setObraId(String(r.obraId));
    if (r.solicitante) setSolicitante(r.solicitante);
    setDataPedido(r.dataPedido);
    if (r.dataNecessidade) {
      setDataNecessidade(r.dataNecessidade);
      setUrgente(r.urgente || diasEntre(r.dataPedido, r.dataNecessidade) <= 1);
    }
    setOrigem(colado.trim());
    const obs = [...r.observacoes];
    const alertaCnpj = r.alertas.find((a) => a.includes("CNPJ"));
    if (alertaCnpj) obs.push(`ATENÇÃO FATURAMENTO: ${alertaCnpj}`);
    setObservacoes(obs.join("\n"));
    setAlertas(r.alertas);
    const novas: Linha[] = r.itens.map((i) => ({
      chave: seq++,
      materialId: i.materialId,
      novo: i.situacao === "novo" ? { ...i.sugestaoNovo } : null,
      quantidade: String(i.quantidade).replace(".", ","),
      especificacao: "",
      textoOriginal: i.textoOriginal,
      situacao: i.situacao,
      aviso: i.aviso,
      candidatos: i.candidatos,
      sugestao: i.sugestaoNovo,
    }));
    if (novas.length) setLinhas(novas);
    const obra = obras.find((o) => o.id === r.obraId);
    setInterpretado(
      `${r.itens.length} itens${obra ? ` · ${obra.nome} (${r.obraMotivo})` : ""}${r.dataNecessidade ? ` · precisa ${formatarData(r.dataNecessidade)}${r.necessidadeMotivo ? ` (“${r.necessidadeMotivo}”)` : ""}` : ""}`,
    );
    toast.success(`Pedido interpretado: ${r.itens.length} itens. Confira abaixo.`);
    setTimeout(() => document.getElementById("itens")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  // ------------------------------------------------------------------ salvar
  function enviar() {
    const usadas = linhas.filter((l) => l.materialId || l.novo || l.quantidade);
    const semDecisao = usadas.findIndex((l) => !l.materialId && !l.novo);
    if (semDecisao >= 0) {
      toast.error(`Item ${semDecisao + 1}: escolha um material do catálogo ou cadastre como novo`);
      return;
    }
    iniciar(async () => {
      const r = await criarRequisicaoCompletaAction({
        obra: Number(obraId) || 0,
        solicitante,
        dataPedido,
        dataNecessidade,
        urgente,
        origemTexto: origem,
        observacoes,
        itens: usadas.map((l) => ({
          materialId: l.materialId,
          novoMaterial: l.novo ? { ...l.novo, novaCategoria: true } : null,
          quantidade: Number(l.quantidade.replace(/\./g, "").replace(",", ".")),
          especificacao: l.especificacao,
          textoOriginal: l.textoOriginal,
        })),
      });
      if (!r.ok) return void toast.error(r.erro);
      const extra = r.dados.novos.length ? ` · ${r.dados.novos.length} materiais novos no catálogo` : "";
      toast.success(`Requisição #${r.dados.id} criada${extra}`);
      for (const a of r.dados.avisos.filter((a) => a.includes("Categoria NOVA"))) toast.info(a);
      router.push(`/requisicoes/${r.dados.id}`);
    });
  }

  const porId = new Map(materiais.map((m) => [m.id, m]));
  const nomesCategorias = [...new Set([...categorias.map((c) => c.nome), "Fixação", "Cobertura"])];
  const contagem = {
    catalogo: linhas.filter((l) => l.materialId).length,
    novo: linhas.filter((l) => l.novo).length,
    pendente: linhas.filter((l) => !l.materialId && !l.novo && (l.quantidade || l.textoOriginal)).length,
  };

  return (
    <form onSubmit={aoEnviar(enviar)} className="grid gap-4">
      {/* ----------------------------------------------------- colar do WhatsApp */}
      <Card className="border-primary/30 bg-accent/30">
        <CardHeader className="pb-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardPasteIcon className="size-4 text-primary" /> Colar pedido do WhatsApp
            </CardTitle>
            <CardDescription>
              Cole a mensagem como chegou (com cabeçalho, CNPJ, endereço…). O sistema separa obra, prazo e itens, casa com o catálogo e sugere o cadastro do que
              for novo.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Textarea
            ref={areaColar}
            rows={colado ? 8 : 4}
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                interpretar();
              }
            }}
            placeholder={"[20/10/2026, 08:56] Christian: Para OBRA: MAX 94…\n220 blocos de concreto celular (siporex) 07x30x60cm\n30 kg arame recozido 18\nObs entrega imediato"}
            className="bg-card font-mono text-[12.5px]"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={interpretar}>
              <WandSparklesIcon /> Interpretar pedido
            </Button>
            <span className="text-xs text-muted-foreground">Ctrl + Enter também interpreta</span>
            {interpretado && (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-st-ok">
                <CheckCircle2Icon className="size-4" /> {interpretado}
              </span>
            )}
          </div>
          {alertas.length > 0 && (
            <div className="grid gap-1.5">
              {alertas.map((a) => (
                <div key={a} className="flex items-start gap-2 rounded-lg bg-st-atencao-bg px-3 py-2 text-[13px]">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-st-atencao" />
                  {a}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------------- cabeçalho */}
      <Card>
        <CardContent className="grid gap-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Obra">
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger aria-invalid={!obraId && !!interpretado}>
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
              <Input id="solicitante" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Quem pediu (mestre, engenheiro…)" required />
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
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------- itens */}
      <Card id="itens" className="scroll-mt-4">
        <CardHeader className="pb-2">
          <CardTitle>Itens</CardTitle>
          <div className="flex flex-wrap gap-1.5 text-xs">
            {contagem.catalogo > 0 && <Badge tom="ok">{contagem.catalogo} do catálogo</Badge>}
            {contagem.novo > 0 && <Badge tom="info">{contagem.novo} novos</Badge>}
            {contagem.pendente > 0 && <Badge tom="atencao">{contagem.pendente} para decidir</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {linhas.map((l, idx) => {
            const m = l.materialId ? porId.get(l.materialId) : undefined;
            const unidade = m?.unidade ?? l.novo?.unidade;
            return (
              <div
                key={l.chave}
                className={cn(
                  "grid gap-2 rounded-lg border p-2.5",
                  l.situacao === "confirmar" && !l.materialId && !l.novo && "border-st-atencao/50 bg-st-atencao-bg/40",
                  l.novo && "border-st-info/30 bg-st-info-bg/30",
                )}
              >
                {l.textoOriginal && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular font-medium">{idx + 1}.</span>
                    <span className="truncate">
                      Como veio: <span className="font-medium text-foreground">“{l.textoOriginal}”</span>
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-[minmax(0,1fr)_100px_36px] gap-2 sm:grid-cols-[minmax(0,1fr)_110px_minmax(0,0.6fr)_36px]">
                  {l.novo ? (
                    <div className="col-span-3 grid gap-2 sm:col-span-1 sm:grid-cols-[minmax(0,1fr)_76px]">
                      <div className="relative">
                        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 rounded bg-st-info px-1.5 py-0.5 text-[10px] font-semibold text-white">NOVO</span>
                        <Input
                          value={l.novo.nome}
                          onChange={(e) => atualizar(l.chave, { novo: { ...l.novo!, nome: e.target.value } })}
                          className="pl-14"
                          aria-label="Nome padronizado do material novo"
                        />
                      </div>
                      <Select value={l.novo.unidade} onValueChange={(v) => atualizar(l.chave, { novo: { ...l.novo!, unidade: v } })}>
                        <SelectTrigger aria-label="Unidade">
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
                    </div>
                  ) : (
                    <MaterialCombobox
                      ref={(el) => {
                        gatilhos.current.set(l.chave, el);
                      }}
                      materiais={materiais}
                      valor={l.materialId}
                      aoMudar={(id) => {
                        atualizar(l.chave, { materialId: id, novo: null });
                        setTimeout(() => document.getElementById(`qtd-${l.chave}`)?.focus(), 30);
                      }}
                      aoCriar={(texto) =>
                        atualizar(l.chave, {
                          materialId: null,
                          novo: { nome: texto.charAt(0).toUpperCase() + texto.slice(1), unidade: "un", categoria: l.sugestao?.categoria ?? "" },
                          textoOriginal: l.textoOriginal ?? texto,
                        })
                      }
                      className="col-span-3 sm:col-span-1"
                    />
                  )}
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
                    <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{unidade}</span>
                  </div>
                  <Input
                    value={l.especificacao}
                    onChange={(e) => atualizar(l.chave, { especificacao: e.target.value })}
                    placeholder="Especificação (opcional)"
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

                {l.novo && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted-foreground">Categoria:</span>
                    <Input
                      list="categorias-lista"
                      value={l.novo.categoria}
                      onChange={(e) => atualizar(l.chave, { novo: { ...l.novo!, categoria: e.target.value } })}
                      placeholder="Escolha ou digite"
                      className={cn("h-7 w-52 text-xs", !l.novo.categoria && "border-st-atencao")}
                    />
                    {!categorias.some((c) => c.nome === l.novo!.categoria) && l.novo.categoria && <Badge tom="info">categoria nova</Badge>}
                    <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => atualizar(l.chave, { novo: null })}>
                      usar um do catálogo
                    </button>
                  </div>
                )}

                {!l.novo && !l.materialId && l.situacao === "confirmar" && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <AlertTriangleIcon className="size-3.5 text-st-atencao" />
                    <span>{l.aviso}</span>
                    {l.candidatos?.slice(0, 2).map((c) => (
                      <Button key={c.id} type="button" size="xs" variant="outline" onClick={() => atualizar(l.chave, { materialId: c.id })}>
                        Usar “{c.nomePadronizado}”
                      </Button>
                    ))}
                    {l.sugestao && (
                      <Button type="button" size="xs" variant="outline" onClick={() => atualizar(l.chave, { novo: { ...l.sugestao! } })}>
                        <SparklesIcon /> Cadastrar “{l.sugestao.nome}”
                      </Button>
                    )}
                  </div>
                )}
                {l.materialId && l.situacao === "catalogo" && l.textoOriginal && (
                  <div className="flex items-center gap-1.5 text-xs text-st-ok">
                    <CheckCircle2Icon className="size-3.5" /> reconhecido no catálogo
                  </div>
                )}
              </div>
            );
          })}
          <datalist id="categorias-lista">
            {nomesCategorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Button type="button" variant="outline" size="sm" className="mt-1 w-fit" onClick={adicionarLinha}>
            <PlusIcon /> Adicionar item
          </Button>
          {contagem.novo > 0 && (
            <p className="text-xs text-muted-foreground">
              Materiais <strong>NOVO</strong> entram no catálogo ao salvar, com o texto “como veio” guardado como sinônimo: na próxima vez o sistema reconhece sozinho.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-5">
          <Campo rotulo="Observações" htmlFor="observacoes">
            <Textarea id="observacoes" rows={3} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Local de descarga, horário, contato na obra…" />
          </Campo>
          {origem && (
            <details className="text-[13px]">
              <summary className="cursor-pointer text-muted-foreground">Mensagem original (fica guardada na requisição)</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 text-xs whitespace-pre-wrap">{origem}</pre>
            </details>
          )}
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
  );
}
