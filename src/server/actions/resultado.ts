import { ZodError } from "zod";
import { mensagemErro } from "@/lib/validacao";

export type Resultado<T = undefined> = { ok: true; dados: T } | { ok: false; erro: string };

/** Executa uma gravação e converte erros em mensagem legível para a tela. */
export function executar<T>(fn: () => T): Resultado<T> {
  try {
    return { ok: true, dados: fn() };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, erro: mensagemErro(e) };
    if (e instanceof Error) {
      if (e.message.includes("UNIQUE constraint failed")) return { ok: false, erro: "Registro duplicado" };
      if (e.message.includes("FOREIGN KEY constraint failed"))
        return { ok: false, erro: "Registro em uso por outros dados" };
      return { ok: false, erro: e.message };
    }
    return { ok: false, erro: "Erro inesperado" };
  }
}
