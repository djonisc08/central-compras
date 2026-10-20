import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { obterEmpresa } from "@/server/dados/empresa";
import { BottomNav, MobileTopBar, Sidebar } from "@/components/app-nav";

async function SidebarComEmpresa() {
  await connection();
  const empresa = obterEmpresa(getDb());
  return <Sidebar empresa={empresa.nomeFantasia ?? empresa.razaoSocial} />;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={<Sidebar empresa="" />}>
        <SidebarComEmpresa />
      </Suspense>
      <MobileTopBar />
      <main className="min-w-0 pb-24 lg:pb-10 lg:pl-60">
        <div className="mx-auto w-full max-w-[1400px] px-4 pt-5 sm:px-6 lg:px-8 lg:pt-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
