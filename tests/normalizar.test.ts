import { describe, expect, it } from "vitest";
import { buscarMateriais, cnpjValido, linkWhatsapp, normalizarTexto, normalizarWhatsapp } from "@/lib/normalizar";
import { textoParaCentavos } from "@/lib/dinheiro";

const catalogo = [
  { id: 1, nomePadronizado: "Cimento CPII-E 32 50kg", unidade: "sc", sinonimos: ["CP2 50kg", "Cimento CP2"] },
  { id: 2, nomePadronizado: "Vergalhão CA-50 10,0mm barra 12m", unidade: "br", sinonimos: ["Ferro 3/8", "Aço 10mm"] },
  { id: 3, nomePadronizado: "Cabo flexível 2,5mm² 750V rolo 100m", unidade: "rl", sinonimos: ["Fio 2,5"] },
];

describe("normalização", () => {
  it("remove acento, caixa e pontuação", () => {
    expect(normalizarTexto("  Vergalhão CA-50  10,0mm ")).toBe("vergalhao ca 50 10.0mm");
  });
  it("valida CNPJ", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11.222.333/0001-80")).toBe(false);
  });
  it("normaliza WhatsApp com DDI", () => {
    expect(normalizarWhatsapp("(47) 99123-0011")).toBe("5547991230011");
  });
  it("lê valores digitados em reais", () => {
    expect(textoParaCentavos("1.234,56")).toBe(123456);
    expect(textoParaCentavos("38,9")).toBe(3890);
    expect(textoParaCentavos("R$ 12")).toBe(1200);
    expect(textoParaCentavos("abc")).toBeNull();
  });
});

describe("casamento com o catálogo", () => {
  it("acha pelo sinônimo exato", () => {
    const [r] = buscarMateriais("cp2 50KG", catalogo);
    expect(r.id).toBe(1);
    expect(r.motivo).toBe("sinonimo_exato");
  });
  it("acha por semelhança", () => {
    expect(buscarMateriais("ferro 3/8 barra", catalogo)[0].id).toBe(2);
    expect(buscarMateriais("fio 2,5 rolo", catalogo)[0].id).toBe(3);
  });
  it("não inventa correspondência", () => {
    expect(buscarMateriais("telha fibrocimento", catalogo)).toHaveLength(0);
  });
});

describe("WhatsApp do fornecedor", () => {
  it("aceita os formatos comuns e usa o primeiro número válido", () => {
    expect(normalizarWhatsapp("(48) 99642-1767")).toBe("5548996421767");
    expect(normalizarWhatsapp("+55 48 9 9168-5020")).toBe("5548991685020");
    expect(normalizarWhatsapp("048 99168-5020")).toBe("5548991685020");
    expect(normalizarWhatsapp("48 99168-5020 / 48 3333-4444")).toBe("5548991685020");
    expect(normalizarWhatsapp("(48) 3333-4444")).toBe("554833334444");
  });
  it("recusa número incompleto ou misturado", () => {
    expect(normalizarWhatsapp("9916-8502")).toBeNull();
    expect(normalizarWhatsapp("4899168502048")).toBeNull();
    expect(linkWhatsapp("123", "oi")).toBeNull();
  });
});
