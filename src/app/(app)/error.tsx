"use client";

import { LoadError } from "@/components/load-error";

// Erro em qualquer tela interna: mantém o menu lateral e mostra a tela de erro em português (em vez da tela branca).
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <LoadError reset={reset} digest={error.digest} />;
}
