"use client";

import { LoadError } from "@/components/load-error";
import "./globals.css";

// Erro no layout principal (fora das telas internas): substitui o documento inteiro, por isso tem <html> e <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen items-center px-4">
        <LoadError reset={reset} digest={error.digest} />
      </body>
    </html>
  );
}
