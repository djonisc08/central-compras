import type { FormEvent } from "react";

/**
 * Submissão controlada: não usa `<form action>` porque o React 19 limpa o
 * formulário ao terminar a ação, inclusive quando a gravação falha.
 */
export function aoEnviar(fn: (dados: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    fn(new FormData(e.currentTarget));
  };
}
