"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2Icon,
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
    <aside className="nao-imprimir fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
          </svg>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[13.5px] font-semibold">Central de Compras</div>
          <div className="truncate text-[11.5px] text-muted-foreground">{empresa}</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-3">
        {ITENS.map((i) => (
          <NavLink key={i.href} item={i} ativo={ativo(pathname, i.href)} />
        ))}
        <div className="mt-auto flex flex-col gap-0.5 border-t pt-3">
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
        "group flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        ativo && "bg-accent text-accent-foreground hover:bg-accent",
      )}
    >
      <Icone className={cn("size-4 transition-colors", ativo ? "text-primary" : "text-muted-foreground/80 group-hover:text-foreground")} />
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
              at && "text-primary",
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
    <header className="nao-imprimir sticky top-0 z-20 flex h-12 items-center justify-between border-b bg-card/90 px-4 backdrop-blur lg:hidden">
      <Link href="/" className="flex items-center gap-2 text-[13.5px] font-semibold">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />
          </svg>
        </span>
        Central de Compras
      </Link>
      <Link href="/configuracoes" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted" aria-label="Configurações">
        <SettingsIcon className="size-4.5" />
      </Link>
    </header>
  );
}
