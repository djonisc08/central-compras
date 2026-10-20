export default function ImpressaoLayout({ children }: LayoutProps<"/">) {
  return <div className="min-h-dvh bg-muted/50 py-6 print:bg-white print:py-0">{children}</div>;
}
