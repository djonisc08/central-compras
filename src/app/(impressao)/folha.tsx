import type { ConfigEmpresa } from "@/db/schema";
import { formatarCnpj } from "@/lib/normalizar";
import { BotaoImprimir } from "./botao-imprimir";

/** Folha A4 com cabeçalho da empresa. */
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
  return (
    <>
      {paisagem && <style>{`@media print { @page { size: A4 landscape; } }`}</style>}
      <div className="nao-imprimir mx-auto mb-4 flex max-w-[297mm] items-center justify-between px-4">
        <p className="text-[13px] text-muted-foreground">Use “Salvar como PDF” na janela de impressão para gerar o arquivo.</p>
        <BotaoImprimir />
      </div>
      <div
        className={`mx-auto bg-white p-[12mm] text-[12px] text-zinc-900 shadow-sm print:p-0 print:shadow-none ${paisagem ? "max-w-[297mm]" : "max-w-[210mm]"}`}
      >
        <header className="mb-5 flex items-start justify-between gap-6 border-b-2 border-[#0F4C5C] pb-3">
          <div className="flex items-start gap-3">
            {empresa.logoPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={empresa.logoPath} alt="" className="h-12 w-auto object-contain" />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-md bg-[#0F4C5C] text-white">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
                </svg>
              </div>
            )}
            <div className="leading-snug">
              <div className="text-[14px] font-bold">{empresa.razaoSocial}</div>
              {empresa.cnpj && <div>CNPJ {formatarCnpj(empresa.cnpj)}</div>}
              <div className="text-zinc-600">{[empresa.endereco, empresa.cidade].filter(Boolean).join(" · ")}</div>
              <div className="text-zinc-600">{[empresa.telefone, empresa.email].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[16px] font-bold tracking-tight text-[#0F4C5C] uppercase">{titulo}</div>
            {subtitulo && <div className="mt-1 text-zinc-700">{subtitulo}</div>}
          </div>
        </header>
        {children}
      </div>
    </>
  );
}
