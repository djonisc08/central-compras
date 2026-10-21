"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BellRingIcon,
  CheckCircle2Icon,
  CheckIcon,
  ClockIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { formatarNumero, formatarReais } from "@/lib/dinheiro";
import { mensagemCobranca, mensagemCotacao, type DadosMensagemCotacao } from "@/lib/mensagens";
import { ehCelular, linkWhatsapp, normalizarTexto } from "@/lib/normalizar";
import { cn } from "@/lib/utils";
import { registrarCobrancaAction, registrarEnvioAction } from "@/server/actions/cotacao";
import type { FornecedorAcompanhamento } from "@/server/dados/cotacao";

type Item = {
  id: number;
  material: string;
  quantidade: number;
  unidade: string;
  especificacao: string | null;
  categoriaId: number;
  categoria: string;
};

/** "2026-10-21 09:12:00" → "há 40 min". */
function ha(dataHora: string, agora: number) {
  const min = Math.max(0, Math.round((agora - new Date(dataHora.replace(" ", "T")).getTime()) / 60000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 1440) return `há ${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
  return `há ${Math.floor(min / 1440)} dia(s)`;
}
const minutos = (dataHora: string, agora: number) => (agora - new Date(dataHora.replace(" ", "T")).getTime()) / 60000;

export function PedirCotacao({
  requisicaoId,
  itens,
  fornecedores,
  dados,
}: {
  requisicaoId: number;
  itens: Item[];
  fornecedores: FornecedorAcompanhamento[];
  dados: Omit<DadosMensagemCotacao, "itens" | "contato">;
}) {
  const [, iniciar] = useTransition();
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [busca, setBusca] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const escolhidos = itens.filter((i) => marcados.has(i.id));
  const grupos = [...Map.groupBy(itens, (i) => i.categoria)];

  const alternar = (ids: number[], ligar: boolean) =>
    setMarcados((m) => {
      const n = new Set(m);
      for (const id of ids) {
        if (ligar) n.add(id);
        else n.delete(id);
      }
      return n;
    });

  // Quem vende o que foi marcado aparece primeiro; o resto fica em "outros fornecedores".
  const { vendem, outros } = useMemo(() => {
    const catsEscolhidas = new Set(itens.filter((i) => marcados.has(i.id)).map((i) => i.categoriaId));
    const b = normalizarTexto(busca);
    const lista = fornecedores.filter((f) => !b || normalizarTexto(`${f.nome} ${f.contato ?? ""} ${f.categorias.join(" ")}`).includes(b));
    const vende = (f: FornecedorAcompanhamento) => f.categoriaIds.some((c) => catsEscolhidas.has(c));
    return { vendem: lista.filter(vende), outros: lista.filter((f) => !vende(f)) };
  }, [fornecedores, busca, itens, marcados]);

  const acompanhando = fornecedores.filter((f) => f.enviadoEm || f.respondeuEm);
  const mensagem = (f: FornecedorAcompanhamento) => mensagemCotacao({ ...dados, itens: escolhidos, contato: f.contato });
  const sufixo = (f?: FornecedorAcompanhamento) =>
    `?${new URLSearchParams({ ...(f ? { fornecedor: String(f.id) } : {}), ...(escolhidos.length ? { itens: escolhidos.map((i) => i.id).join(",") } : {}) })}`;
  const enviou = (f: FornecedorAcompanhamento) =>
    iniciar(async () => void (await registrarEnvioAction(requisicaoId, f.id, escolhidos.length)));

  async function copiar(f: FornecedorAcompanhamento) {
    try {
      await navigator.clipboard.writeText(mensagem(f));
      setCopiado(f.id);
      setTimeout(() => setCopiado(null), 1800);
      toast.success(`Mensagem para ${f.nome} copiada (${escolhidos.length} itens)`);
      enviou(f);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  function Situacao({ f }: { f: FornecedorAcompanhamento }) {
    if (f.respondeuEm)
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-st-ok">
          <CheckCircle2Icon className="size-3.5" /> Cotou {f.itensCotados} itens
          {f.totalCotado != null && <span className="tabular">· {formatarReais(f.totalCotado)}</span>}
        </span>
      );
    if (f.enviadoEm) {
      const ref = f.cobradoEm ?? f.enviadoEm;
      const demorando = minutos(ref, agora) >= (dados.urgente ? 60 : 1440);
      return (
        <span className={cn("inline-flex items-center gap-1 text-xs", demorando ? "font-medium text-st-atencao" : "text-muted-foreground")}>
          <ClockIcon className="size-3.5" />
          {f.cobradoEm ? "Cobrado" : `Enviado ${f.qtdEnviada} itens`} {ref.slice(11, 16)} · {ha(ref, agora)}
        </span>
      );
    }
    return null;
  }

  function LinhaFornecedor({ f, vende }: { f: FornecedorAcompanhamento; vende: boolean }) {
    const wa = linkWhatsapp(f.whatsapp, mensagem(f));
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
        <div className="min-w-0 flex-1 basis-40">
          <div className="flex items-center gap-1.5 truncate text-[13px] font-medium">
            {f.nome}
            {vende && <Badge tom="ok">vende</Badge>}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {f.contato ?? "—"}
            {f.whatsapp && wa && !ehCelular(f.whatsapp) && <span className="text-st-atencao"> · número fixo, pode não ter WhatsApp</span>}
            {f.categorias.length > 0 && (
              <span title={f.categorias.join(", ")}>
                {" "}
                · {f.categorias.slice(0, 3).join(", ")}
                {f.categorias.length > 3 && ` +${f.categorias.length - 3}`}
              </span>
            )}
          </div>
        </div>
        <Situacao f={f} />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => copiar(f)} aria-label={`Copiar mensagem para ${f.nome}`}>
            {copiado === f.id ? <CheckIcon className="text-st-ok" /> : <CopyIcon />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Arquivos para ${f.nome}`}>
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={`/imprimir/cotacao/${requisicaoId}${sufixo(f)}`} target="_blank" rel="noreferrer" onClick={() => enviou(f)}>
                  <FileTextIcon /> PDF para {f.nome}
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/api/exportar/cotacao/${requisicaoId}${sufixo(f)}`} onClick={() => enviou(f)}>
                  <FileSpreadsheetIcon /> Planilha para {f.nome}
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {wa ? (
            <Button variant="outline" size="sm" asChild>
              <a href={wa} target="_blank" rel="noreferrer" onClick={() => enviou(f)} aria-label={`Enviar para ${f.nome} no WhatsApp`}>
                <MessageCircleIcon className="text-st-ok" /> Enviar
              </a>
            </Button>
          ) : (
            <a
              href={`/fornecedores?busca=${encodeURIComponent(f.nome)}`}
              className="rounded-md border border-st-atencao/50 bg-st-atencao-bg px-2 py-1 text-xs font-medium text-st-atencao hover:underline"
              title={f.whatsapp ? `Número cadastrado: ${f.whatsapp}` : "Sem número cadastrado"}
            >
              {f.whatsapp ? "WhatsApp inválido · corrigir" : "sem WhatsApp · cadastrar"}
            </a>
          )}
        </div>
      </li>
    );
  }

  const todosMarcados = marcados.size === itens.length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pedir cotação</CardTitle>
          <CardDescription>Marque os itens e escolha para quem enviar. Pode mandar tudo para um fornecedor ou dividir.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => alternar(itens.map((i) => i.id), !todosMarcados)}>
          {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
        </Button>
      </CardHeader>
      <CardContent className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {grupos.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Marcar por tipo:</span>
            {grupos.map(([cat, doGrupo]) => {
              const ids = doGrupo.map((i) => i.id);
              const todos = ids.every((id) => marcados.has(id));
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => alternar(ids, !todos)}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-0.5 transition-colors",
                    todos ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50",
                  )}
                >
                  {cat} ({ids.length})
                </button>
              );
            })}
          </div>
        )}

        <ul className="divide-y rounded-lg border">
          {itens.map((i) => (
            <li key={i.id}>
              <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50", marcados.has(i.id) && "bg-accent/40")}>
                <Checkbox checked={marcados.has(i.id)} onCheckedChange={(v) => alternar([i.id], v === true)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px]">{i.material}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {i.categoria}
                    {i.especificacao && <> · {i.especificacao}</>}
                  </span>
                </span>
                <span className="tabular shrink-0 text-[13px]">
                  {formatarNumero(i.quantidade)} <span className="text-xs text-muted-foreground">{i.unidade}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>

        {escolhidos.length > 0 ? (
          <div className="rounded-xl border-2 border-primary/40 bg-accent/20">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="flex items-center gap-2 text-[13.5px] font-semibold">
                <SendIcon className="size-4 text-primary" /> Encaminhar {escolhidos.length} {escolhidos.length === 1 ? "item" : "itens"} para:
              </div>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar fornecedor" className="h-8 w-52 pl-8 text-[13px]" />
              </div>
            </div>
            <ul className="divide-y">
              {vendem.map((f) => (
                <LinhaFornecedor key={f.id} f={f} vende />
              ))}
              {(verTodos || busca || vendem.length === 0) && outros.map((f) => <LinhaFornecedor key={f.id} f={f} vende={false} />)}
            </ul>
            {!verTodos && !busca && vendem.length > 0 && outros.length > 0 && (
              <button type="button" onClick={() => setVerTodos(true)} className="w-full cursor-pointer border-t px-3 py-2 text-left text-xs text-primary hover:underline">
                Ver outros {outros.length} fornecedores
              </button>
            )}
          </div>
        ) : (
          <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-center text-[13px] text-muted-foreground">
            Marque um ou mais itens acima para escolher o fornecedor.
          </p>
        )}

        {acompanhando.length > 0 && (
          <div>
            <div className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Acompanhamento · {acompanhando.filter((f) => f.respondeuEm).length} de {acompanhando.length} responderam
            </div>
            <ul className="divide-y rounded-lg border">
              {acompanhando.map((f) => {
                const cobrar = linkWhatsapp(
                  f.whatsapp,
                  mensagemCobranca({ requisicaoId, obra: dados.obra, contato: f.contato, urgente: dados.urgente, qtdItens: f.qtdEnviada }),
                );
                return (
                  <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{f.nome}</span>
                    <Situacao f={f} />
                    {!f.respondeuEm && cobrar && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={cobrar}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => iniciar(async () => void (await registrarCobrancaAction(requisicaoId, f.id)))}
                        >
                          <BellRingIcon /> Cobrar
                        </a>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
