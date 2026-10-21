import type { MetadataRoute } from "next";

/** "Adicionar à tela inicial" no celular: abre como app, sem a barra do navegador. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Central de Compras · MAX Incorporações",
    short_name: "Compras MAX",
    start_url: "/",
    display: "standalone",
    background_color: "#141414",
    theme_color: "#141414",
    lang: "pt-BR",
    icons: [
      { src: "/marca/icone-192.png", sizes: "192x192", type: "image/png" },
      { src: "/marca/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
