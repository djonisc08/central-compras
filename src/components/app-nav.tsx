"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2Icon,
  CalendarDaysIcon,
  ClipboardListIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ReceiptTextIcon,
  SettingsIcon,
  TruckIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; rotulo: string; curto: string; icone: LucideIcon; celular?: boolean };

const ITENS: Item[] = [
  { href: "/", rotulo: "Painel", curto: "Painel", icone: LayoutDashboardIcon, celular: true },
  { href: "/dia", rotulo: "Meu dia", curto: "Dia", icone: CalendarDaysIcon },
  { href: "/requisicoes", rotulo: "Requisições", curto: "Requisições", icone: ClipboardListIcon, celular: true },
  { href: "/pedidos", rotulo: "Pedidos", curto: "Pedidos", icone: ReceiptTextIcon, celular: true },
  { href: "/fornecedores", rotulo: "Fornecedores", curto: "Fornec.", icone: TruckIcon, celular: true },
  { href: "/materiais", rotulo: "Materiais", curto: "Materiais", icone: PackageIcon, celular: true },
  { href: "/obras", rotulo: "Obras", curto: "Obras", icone: Building2Icon },
];

const RODAPE: Item[] = [{ href: "/configuracoes", rotulo: "Configurações", curto: "Config.", icone: SettingsIcon }];

function ativo(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ empresa }: { empresa: string }) {
  const pathname = usePathname();
  return (
    <aside className="nao-imprimir fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-sidebar text-white lg:flex">
      <Link href="/" className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marca/max-logo-branca.png" alt="MAX Incorporações" className="h-9 w-auto shrink-0" />
        <div className="min-w-0 border-l border-white/15 pl-3 leading-tight">
          <div className="font-marca text-[13.5px] font-semibold whitespace-nowrap">Central de Compras</div>
          <div className="truncate text-[11px] text-white/55">{empresa}</div>
        </div>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {ITENS.map((i) => (
          <NavLink key={i.href} item={i} ativo={ativo(pathname, i.href)} />
        ))}
        <div className="mt-auto flex flex-col gap-0.5 border-t border-white/10 pt-3">
          {RODAPE.map((i) => (
            <NavLink key={i.href} item={i} ativo={ativo(pathname, i.href)} />
          ))}
        </div>
      </nav>
    </aside>
  );
}

function NavLink({ item, ativo }: { item: Item; ativo: boolean }) {
  const Icone = item.icone;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium text-white/65 transition-colors hover:bg-white/8 hover:text-white",
        ativo && "bg-white/10 text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-marca-verde hover:bg-white/10",
      )}
    >
      <Icone className={cn("size-4 transition-colors", ativo ? "text-marca-verde" : "text-white/50 group-hover:text-white")} />
      {item.rotulo}
    </Link>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="nao-imprimir fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {ITENS.filter((i) => i.celular).map((i) => {
        const Icone = i.icone;
        const at = ativo(pathname, i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium text-muted-foreground",
              at && "text-marca-verde-escuro",
            )}
          >
            <Icone className="size-5" strokeWidth={at ? 2.2 : 1.8} />
            {i.curto}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTopBar() {
  return (
    <header className="nao-imprimir sticky top-0 z-20 flex h-12 items-center justify-between bg-marca-preto px-4 text-white lg:hidden">
      <Link href="/" className="flex items-center gap-2.5 font-marca text-[14px] font-semibold tracking-wide">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/marca/max-logo-branca.png" alt="MAX Incorporações" className="h-7 w-auto" />
        <span className="border-l border-white/20 pl-2.5">Central de Compras</span>
      </Link>
      <Link href="/configuracoes" className="rounded-md p-1.5 text-white/70 hover:bg-white/10" aria-label="Configurações">
        <SettingsIcon className="size-4.5" />
      </Link>
    </header>
  );
}
