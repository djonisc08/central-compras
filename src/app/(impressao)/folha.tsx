import type { ConfigEmpresa } from "@/db/schema";
import { formatarData, hojeISO } from "@/lib/datas";
import { formatarCnpj } from "@/lib/normalizar";
import { BotaoImprimir } from "./botao-imprimir";

/** Padrão de triângulos do site da MAX, discreto no topo do papel timbrado. */
function Triangulos() {
  return (
    <svg className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 opacity-[0.05]" aria-hidden>
      <defs>
        <pattern id="triangulos-max" width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M0 44 L22 22 L0 0 Z M44 0 L22 22 L44 44 Z" fill="#fff" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#triangulos-max)" />
    </svg>
  );
}

/** Folha A4 no papel timbrado da MAX (topo preto com a logo, faixa verde, rodapé com contato). */
export function Folha({
  empresa,
  titulo,
  subtitulo,
  paisagem = false,
  children,
}: {
  empresa: ConfigEmpresa;
  titulo: string;
  subtitulo?: React.ReactNode;
  paisagem?: boolean;
  children: React.ReactNode;
}) {
  const contato = [empresa.telefone, empresa.email].filter(Boolean).join(" · ");
  return (
    <>
      {paisagem && <style>{`@media print { @page { size: A4 landscape; } }`}</style>}
      <div className="nao-imprimir mx-auto mb-4 flex max-w-[297mm] items-center justify-between px-4">
        <p className="text-[13px] text-muted-foreground">Use “Salvar como PDF” na janela de impressão para gerar o arquivo.</p>
        <BotaoImprimir />
      </div>
      <div
        className={`mx-auto flex min-h-[260mm] flex-col bg-white p-[12mm] pt-0 text-[12px] text-zinc-900 shadow-sm print:min-h-0 print:p-0 print:shadow-none ${paisagem ? "max-w-[297mm]" : "max-w-[210mm]"}`}
      >
        <header className="relative -mx-[12mm] flex items-center justify-between gap-6 overflow-hidden bg-marca-preto px-[12mm] py-5 text-white print:mx-0 print:rounded-sm print:px-6">
          <Triangulos />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={empresa.logoPath || "/marca/max-logo-branca.png"} alt={empresa.nomeFantasia ?? empresa.razaoSocial} className="relative h-14 w-auto object-contain" />
          <div className="relative text-right">
            <div className="font-marca text-[19px] leading-tight font-semibold tracking-wide text-marca-verde uppercase">{titulo}</div>
            {subtitulo && <div className="mt-1 text-[11.5px] text-white/80">{subtitulo}</div>}
          </div>
        </header>
        <div className="-mx-[12mm] h-1.5 bg-marca-verde print:mx-0" />
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-zinc-200 py-2 text-[10.5px] text-zinc-600">
          <span>
            <strong className="font-semibold text-zinc-900">{empresa.razaoSocial}</strong>
            {empresa.cnpj && <> · CNPJ {formatarCnpj(empresa.cnpj)}</>}
          </span>
          <span>{[empresa.endereco, empresa.cidade].filter(Boolean).join(" · ")}</span>
        </div>

        <main className="flex-1">{children}</main>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t-2 border-marca-verde pt-2 text-[9.5px] text-zinc-500">
          <span>
            <strong className="font-marca font-semibold tracking-wide text-marca-preto">MAX INCORPORAÇÕES</strong>
            {contato && <> · {contato}</>} · maxincorporacoes.com.br
          </span>
          <span>Central de Compras · emitido em {formatarData(hojeISO())}</span>
        </footer>
      </div>
    </>
  );
}
