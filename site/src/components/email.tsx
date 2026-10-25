import { EMPRESA } from "@/content/empresa";

/** E-mail oficial em texto, com <wbr> antes do @ (quebra de linha no celular e sem reescrita da Cloudflare). */
export function EmailTexto() {
  const [usuario, dominio] = EMPRESA.email.split("@");
  return (
    <>
      {usuario}
      <wbr />@{dominio}
    </>
  );
}
