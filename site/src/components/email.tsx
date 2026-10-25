"use client";

import { useEffect, useState } from "react";
import { EMPRESA, MAILTO } from "@/content/empresa";

/**
 * A Cloudflare do domínio tem a "proteção de e-mail" ligada: todo mailto: e todo endereço que ela acha no HTML vira um
 * link codificado, e ela injeta um script que segura a primeira pintura (~0,5 s). Por isso o HTML sai sem o endereço:
 * o link aponta para /contato/ e vira mailto: assim que a página carrega; o texto leva <wbr> antes do @.
 */
export function EmailTexto() {
  const [usuario, dominio] = EMPRESA.email.split("@");
  return (
    <>
      {usuario}
      <wbr />@{dominio}
    </>
  );
}

export function LinkEmail({ className, style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  const [href, setHref] = useState("/contato/");
  useEffect(() => setHref(MAILTO), []);
  return (
    <a className={className} style={style} href={href}>
      {children}
    </a>
  );
}
