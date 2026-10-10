"use client";

import { useSearchParams } from "next/navigation";

/** Aviso exibido quando alguém tenta abrir uma área fora do seu nível de acesso. */
export function NoPermissionNotice() {
  const sp = useSearchParams();
  if (sp.get("sem_permissao") !== "1") return null;
  return (
    <p role="alert" className="mb-4 rounded-md border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-warn" data-testid="no-permission">
      Seu nível de acesso não permite abrir aquela área. Se precisar, peça ao usuário mestre.
    </p>
  );
}
