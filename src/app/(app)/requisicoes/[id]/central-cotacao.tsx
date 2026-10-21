"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  BellRingIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatarNumero, formatarReais } from "@/lib/dinheiro";
import { linkWhatsapp } from "@/lib/normalizar";
import { cn } from "@/lib/utils";
import { mudarCategoriaMaterialAction, registrarCobrancaAction, registrarEnvioAction } from "@/server/actions/cotacao";

export type FornecedorLote = {
  id: number;
  nome: string;
  contato: string | null;
  whatsapp: string | null;
  qtdItens: number;
  outrosLotes: string[];
  mensagem: string;
  cobranca: string;
  enviadoEm: string | null;
  cobradoEm: string | null;
  respondeuEm: string | null;
  itensCotados: number;
  totalCotado: number | null;
};

export type Lote = {
  categoriaId: number;
  categoria: string;
  itens: { id: number; materialId: number; material: string; quantidade: number; unidade: string }[];
  fornecedores: FornecedorLote[];
};

/** "2026-10-21 09:12:00" → minutos desde então. */
function minutosDesde(dataHora: string, agora: number) {
  return Math.max(0, Math.round((agora - new Date(dataHora.replace(" ", "T")).getTime()) / 60000));
}
function ha(min: number) {
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  if (min < 60 * 24) return `há ${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
  return `há ${Math.floor(min / 1440)} dia(s)`;
}
const hora = (d: string) => d.slice(11, 16);

export function CentralCotacao({
  requisicaoId,
  urgente,
  lotes,
  categorias,
}: {
  requisicaoId: number;
  urgente: boolean;
  lotes: Lote[];
  categorias: { id: number; nome: string }[];
}) {
  const [, iniciar] = useTransition();
  const [copiado, setCopiado] = useState<number | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const unicos = new Map(lotes.flatMap((l) => l.fornecedores).map((f) => [f.id, f]));
  const enviados = [...unicos.values()].filter((f) => f.enviadoEm || f.respondeuEm).length;
  const responderam = [...unicos.values()].filter((f) => f.respondeuEm).length;

  const pdf = (fid?: number) => `/imprimir/cotacao/${requisicaoId}${fid ? `?fornecedor=${fid}` : ""}`;
  const xlsx = (fid?: number) => `/api/exportar/cotacao/${requisicaoId}${fid ? `?fornecedor=${fid}` : ""}`;

  const enviou = (f: FornecedorLote) => iniciar(async () => void (await registrarEnvioAction(requisicaoId, f.id, f.qtdItens)));

  async function copiar(f: FornecedorLote) {
    try {
      await navigator.clipboard.writeText(f.mensagem);
      setCopiado(f.id);
      setTimeout(() => setCopiado(null), 1800);
      toast.success(`Mensagem para ${f.nome} copiada (${f.qtdItens} itens)`);
      enviou(f);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  }

  function mudarLote(materialId: number, categoriaId: number, nome: string) {
    iniciar(async () => {
      const r = await mudarCategoriaMaterialAction(materialId, categoriaId);
      if (r.ok) toast.success(`Movido para ${nome} (vale para as próximas requisições também)`);
      else toast.error(r.erro);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Cotação por lote</CardTitle>
          <CardDescription>
            Os itens se separam pela categoria. Cada fornecedor recebe <strong>só os itens que ele vende</strong>.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {enviados} enviados · <span className={cn(responderam && "font-medium text-st-ok")}>{responderam} responderam</span>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FileTextIcon /> Lista completa <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={pdf()} target="_blank" rel="noreferrer">
                  <FileTextIcon /> PDF com todos os itens
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={xlsx()}>
                  <FileSpreadsheetIcon /> Planilha com todos os itens
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {lotes.map((l) => (
          <section key={l.categoriaId} className="rounded-xl border">
            <div className="border-b bg-muted/40 px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[13.5px] font-semibold">
                  {l.categoria} <span className="font-normal text-muted-foreground">· {l.itens.length} {l.itens.length === 1 ? "item" : "itens"}</span>
                </h3>
                {l.fornecedores.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {l.fornecedores.filter((f) => f.respondeuEm).length}/{l.fornecedores.length} responderam
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {l.itens.map((i) => (
                  <DropdownMenu key={i.id}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md border bg-card px-2 py-0.5 text-xs hover:border-primary/50"
                        title="Trocar de lote"
                      >
                        <span className="truncate">{i.material}</span>
                        <span className="tabular shrink-0 text-muted-foreground">
                          {formatarNumero(i.quantidade)} {i.unidade}
                        </span>
                        <ChevronDownIcon className="size-3 shrink-0 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-72 overflow-y-auto">
                      <DropdownMenuLabel>Mover para o lote…</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {categorias
                        .filter((c) => c.id !== l.categoriaId)
                        .map((c) => (
                          <DropdownMenuItem key={c.id} onSelect={() => mudarLote(i.materialId, c.id, c.nome)}>
                            {c.nome}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ))}
              </div>
            </div>

            {l.fornecedores.length === 0 ? (
              <p className="px-3.5 py-3 text-[13px] text-st-atencao">
                Nenhum fornecedor cadastrado para {l.categoria}.{" "}
                <Link href="/fornecedores" className="font-medium underline">
                  Marcar a categoria nos fornecedores
                </Link>
              </p>
            ) : (
              <ul className="divide-y">
                {l.fornecedores.map((f) => {
                  const wa = linkWhatsapp(f.whatsapp, f.mensagem);
                  const waCobrar = linkWhatsapp(f.whatsapp, f.cobranca);
                  const esperando = f.enviadoEm && !f.respondeuEm ? minutosDesde(f.cobradoEm ?? f.enviadoEm, agora) : null;
                  const demorando = esperando != null && esperando >= (urgente ? 60 : 24 * 60);
                  return (
                    <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2">
                      <div className="min-w-0 flex-1 basis-40">
                        <div className="truncate text-[13px] font-medium">{f.nome}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {f.contato ?? "—"}
                          {f.outrosLotes.length > 0 && <> · vai junto: {f.outrosLotes.join(", ")}</>}
                        </div>
                      </div>

                      <div className="text-xs">
                        {f.respondeuEm ? (
                          <span className="inline-flex items-center gap-1 font-medium text-st-ok">
                            <CheckCircle2Icon className="size-3.5" /> Cotou {f.itensCotados}/{f.qtdItens}
                            {f.totalCotado != null && <span className="tabular">· {formatarReais(f.totalCotado)}</span>}
                          </span>
                        ) : f.enviadoEm ? (
                          <span className={cn("inline-flex items-center gap-1", demorando ? "font-medium text-st-atencao" : "text-muted-foreground")}>
                            <ClockIcon className="size-3.5" />
                            {f.cobradoEm ? `Cobrado ${hora(f.cobradoEm)}` : `Enviado ${hora(f.enviadoEm)}`} · {ha(esperando ?? 0)}
                          </span>
                        ) : (
                          <Badge tom="neutro">não enviado</Badge>
                        )}
                      </div>

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
                              <a href={pdf(f.id)} target="_blank" rel="noreferrer" onClick={() => enviou(f)}>
                                <FileTextIcon /> PDF para {f.nome} ({f.qtdItens} itens)
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={xlsx(f.id)} onClick={() => enviou(f)}>
                                <FileSpreadsheetIcon /> Planilha para {f.nome}
                              </a>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {f.enviadoEm && !f.respondeuEm && waCobrar && (
                          <Button variant={demorando ? "default" : "outline"} size="sm" asChild>
                            <a
                              href={waCobrar}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => iniciar(async () => void (await registrarCobrancaAction(requisicaoId, f.id)))}
                            >
                              <BellRingIcon /> Cobrar
                            </a>
                          </Button>
                        )}
                        {wa && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={wa} target="_blank" rel="noreferrer" onClick={() => enviou(f)} aria-label={`Enviar para ${f.nome} no WhatsApp`}>
                              <MessageCircleIcon className="text-st-ok" /> {f.enviadoEm ? "Reenviar" : "Enviar"}
                            </a>
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
