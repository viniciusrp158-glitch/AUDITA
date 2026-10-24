/** Dados oficiais da AUDITA (briefing, seção 2). Usar exatamente assim; não inventar outros contatos. */
export const EMPRESA = {
  nome: "AUDITA",
  assinatura: "AUDITA | SSMA & SGI",
  slogan: "Gestão inteligente para ambientes mais seguros.",
  cnpj: "69.563.249/0001-01",
  endereco: "Rua Oswaldo de Barros, 219 – Hebert de Souza – Sorocaba/SP – CEP 18079-026",
  telefone: "(15) 99689-1049",
  whatsapp: "5515996891049",
  email: "engenharia.audita@outlook.com",
  proLogin: "https://auditapro.app.br",
  hubLogin: "https://auditahub.app.br",
  treinamentos: "/treinamentos",
} as const;

/** Redes sociais: só entram quando o Vinicius confirmar os perfis (briefing, seção 2). */
export const REDES_SOCIAIS_PUBLICADAS = false;

/** Link do WhatsApp com mensagem pronta. */
export function whatsapp(mensagem = "Olá! Quero falar com a AUDITA."): string {
  return `https://wa.me/${EMPRESA.whatsapp}?text=${encodeURIComponent(mensagem)}`;
}

export const MAILTO = `mailto:${EMPRESA.email}`;
