import { describe, expect, it } from "vitest";
import { adivinharCategoria, interpretarPedido, padronizarNome } from "@/lib/interpretar-pedido";

const obras = [
  { id: 1, nome: "MAX Studios 177", cnpj: "11249827000400", cno: null, endereco: "Rua Álvaro José Dias, 177 – Pantanal" },
  { id: 2, nome: "MAX Studios 189", cnpj: "11249827000311", cno: "90.022.17945/71", endereco: "Rua Vereador Frederico Veras, 189 – Pantanal" },
  { id: 3, nome: "MAX Studio 206", cnpj: "11249827000230", cno: "90.021.28665/76", endereco: "Rua Maria Eduarda, 206 – Pantanal" },
];
const catalogo = [
  { id: 1, nomePadronizado: "Cimento CPII-E 32 50kg", unidade: "sc", sinonimos: ["CP2 50kg", "Cimento CP2", "cimento"] },
  { id: 6, nomePadronizado: "Areia média lavada", unidade: "m³", sinonimos: ["Areia média", "Areia"] },
  { id: 10, nomePadronizado: "Vergalhão CA-50 10,0mm barra 12m", unidade: "br", sinonimos: ["Ferro 3/8"] },
  { id: 14, nomePadronizado: "Arame recozido 18 BWG", unidade: "kg", sinonimos: ["Arame recozido", "Arame 18"] },
  { id: 25, nomePadronizado: "Cabo flexível 2,5mm² 750V rolo 100m", unidade: "rl", sinonimos: ["Fio 2,5"] },
];

const LUANA = `[20/10/2026, 13:04:55] Luana: 220 blocos de concreto celular (siporex) 07x30x60cm
 [20/10/2026, 13:04:55] Luana: 1000 espaçador tipo roseta 3cm
1000 espaçador tipo centopéia 3cm

30 kg arame recozido  12
05kg grampo cerca 19x11
 [20/10/2026, 13:04:56] Luana: Para  OBRA: MAX Studio 189
MAX INCORPORAÇÕES LTDA
CNPJ 11.249.827.0001-50
CNO   90.022.17945/71
* E-mail:  financeiro@maxincorporacoes.com.br
* Contato com Andressa: 48 9864-0014
* Endereço para entrega
Rua Vereador Frederico Veras, 189
Bairro Pantanal, Florianópolis SC
Cep 88040-200
 vou precisar do seguinte item👇🏼

10- Barra perfilado aço perfurada 38x19 BR 6000MM CH-Leve Inbraell

 5- Barra roscada de aço inox 8MM -6 Metros  cada

500- Arruela de inox 8MM

500-Porca de inox 8MM

250-Chumbador parabolt Cb jaqueta 8MM

 250-Cone chumbador CBV 8MM

Obs entrega imediato`;

describe("pedido real da Luana (20/10/2026)", () => {
  const r = interpretarPedido(LUANA, { obras, catalogo }, "2026-10-20");

  it("identifica cabeçalho: obra pelo CNO, solicitante, data e urgência", () => {
    expect(r.obraId).toBe(2);
    expect(r.solicitante).toBe("Luana");
    expect(r.dataPedido).toBe("2026-10-20");
    expect(r.dataNecessidade).toBe("2026-10-20");
    expect(r.urgente).toBe(true);
    expect(r.observacoes).toEqual(["entrega imediato"]);
  });

  it("alerta o CNPJ da matriz diferente da ficha da obra", () => {
    expect(r.cnpjs).toEqual(["11249827000150"]);
    expect(r.alertas.some((a) => a.includes("11.249.827/0001-50") && a.includes("11.249.827/0003-11"))).toBe(true);
  });

  it("extrai os 11 itens com quantidade e unidade, ignorando o cabeçalho", () => {
    expect(r.itens.map((i) => [i.quantidade, i.unidadeInformada])).toEqual([
      [220, null],
      [1000, null],
      [1000, null],
      [30, "kg"],
      [5, "kg"],
      [10, "br"],
      [5, "br"],
      [500, null],
      [500, null],
      [250, null],
      [250, null],
    ]);
    expect(r.itens[6].textoOriginal).toBe("Barra roscada de aço inox 8MM -6 Metros");
    expect(r.itens[3].textoOriginal).toBe("arame recozido 12");
  });

  it("não confunde arame 12 com o arame 18 do catálogo", () => {
    expect(r.itens[3].situacao).toBe("confirmar");
    expect(r.itens[3].materialId).toBeNull();
    expect(r.itens[3].aviso).toContain("12");
  });

  it("sugere nome e categoria para os itens novos", () => {
    expect(r.itens[0].sugestaoNovo).toMatchObject({ nome: "Bloco de concreto celular (siporex) 07x30x60cm", categoria: "Blocos e tijolos", unidade: "un" });
    expect(r.itens[5].sugestaoNovo.categoria).toBe("Elétrica");
    expect(r.itens[6].sugestaoNovo.categoria).toBe("Fixação");
    expect(r.itens[9].sugestaoNovo.categoria).toBe("Fixação");
    expect(r.itens[1].sugestaoNovo.categoria).toBe("Aço e ferragens");
  });
});

describe("formatos comuns", () => {
  it("lista simples com unidade e obra pelo número", () => {
    const r = interpretarPedido(
      "Bom dia! Preciso pra quinta na obra 206:\n- 80 sc de cp2\n- 6 m3 areia média\n- 120 barras ferro 3/8\n- 2 rolos fio 2,5\n- 1 milheiro de tijolo",
      { obras, catalogo },
      "2026-10-20",
    );
    expect(r.obraId).toBe(3);
    expect(r.dataNecessidade).toBe("2026-10-22"); // terça → quinta
    expect(r.itens.map((i) => [i.quantidade, i.unidadeInformada, i.materialId])).toEqual([
      [80, "sc", 1],
      [6, "m³", 6],
      [120, "br", 10],
      [2, "rl", 25],
      [1000, "un", null],
    ]);
  });

  it("data explícita e aviso quando não há obra", () => {
    const r = interpretarPedido("10 kg prego 17x27\npara dia 25/10", { obras, catalogo }, "2026-10-20");
    expect(r.obraId).toBeNull();
    expect(r.dataNecessidade).toBe("2026-10-25");
    expect(r.alertas[0]).toContain("obra");
  });

  it("padroniza nomes e adivinha categorias", () => {
    expect(padronizarNome("telhas fibrocimento 6MM")).toBe("Telha fibrocimento 6mm");
    expect(adivinharCategoria("Vaso sanitário PCD")).toBe("Louças e metais");
    expect(adivinharCategoria("parafuso sextavado 3/8")).toBe("Fixação");
  });
});

describe("pedido de refrigeração (salada mista)", () => {
  const catalogo = [
    { id: 1, nomePadronizado: "Cabo flexível 2,5mm² 750V rolo 100m", unidade: "rl", sinonimos: [], categoria: "Elétrica" },
  ];
  const r = interpretarPedido("Tubo cobre\n15m ⅝\n15 m ⅜\n10 PVC preta\n100 metros cabo pp azul 1,5", { obras: [], catalogo }, "2026-10-21");

  it("lê fração unicode e herda o nome do título acima", () => {
    expect(r.itens.slice(0, 2).map((i) => i.textoOriginal)).toEqual(["Tubo cobre 5/8", "Tubo cobre 3/8"]);
    expect(r.itens[0].sugestaoNovo.categoria).toBe("Refrigeração");
  });

  it("não casa bitola diferente com o catálogo", () => {
    expect(r.itens[3].situacao).not.toBe("catalogo");
  });
});
