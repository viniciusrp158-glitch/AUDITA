import Link from "next/link";
import { Mail, MessageCircle, Phone, Plus } from "lucide-react";
import { isMobile, whatsappLink } from "@/lib/prospect/labels";

/**
 * Ações de contato (adaptação ao celular, pedido do Diretor em 17/11/2026): WhatsApp (link oficial wa.me, quem envia é
 * a pessoa), ligação e e-mail no aplicativo do aparelho. No celular ficam numa barra fixa acima da barra de atalhos;
 * no computador, como botões no topo da página. Sem número/e-mail, o botão aparece apagado. A página deve terminar com
 * <ContactActionsSpacer /> para a barra não cobrir o fim do conteúdo.
 */
export function ContactActions({
  name,
  phone,
  email,
  greeting,
  subject,
  primary,
}: {
  /** Nome de quem será contatado (aparece na explicação). */
  name: string;
  phone: string | null | undefined;
  email: string | null | undefined;
  /** Mensagem inicial do WhatsApp e do e-mail. */
  greeting: string;
  subject: string;
  /** Quarto botão (ex.: Nova demanda). */
  primary?: { href: string; label: string };
}) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const wa = digits ? whatsappLink(digits, greeting) : null;
  const mobile = isMobile(digits);
  const mail = email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(greeting)}` : null;
  const tel = digits ? `tel:+55${digits.replace(/^55(?=\d{10,11}$)/, "")}` : null;
  const items = [
    { key: "wa", href: wa, label: "WhatsApp", sub: wa && !mobile ? "pelo fixo" : null, icon: MessageCircle, external: true, aria: `WhatsApp de ${name}` },
    { key: "tel", href: tel, label: "Ligar", sub: null, icon: Phone, external: false, aria: `Ligar para ${name}` },
    { key: "mail", href: mail, label: "E-mail", sub: null, icon: Mail, external: false, aria: `E-mail para ${name}` },
  ];

  return (
    <>
      {/* Computador */}
      <div className="hidden flex-wrap gap-2 lg:flex" role="group" aria-label="Contato">
        {items.map(({ key, href, label, sub, icon: Icon, external, aria }) =>
          href ? (
            <a
              key={key}
              href={href}
              aria-label={aria}
              {...(external && { target: "_blank", rel: "noopener noreferrer" })}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${key === "wa" ? "bg-ok text-white hover:opacity-90" : "border border-line bg-white text-ink hover:border-navy/40"}`}
            >
              <Icon size={15} /> {label}
              {sub ? ` (${sub})` : ""}
            </a>
          ) : null,
        )}
      </div>
      {/* Celular: barra fixa acima da barra de atalhos */}
      <div
        role="group"
        aria-label="Ações rápidas"
        className={`fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 grid gap-1.5 border-t border-line bg-white px-2 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] lg:hidden ${primary ? "grid-cols-4" : "grid-cols-3"}`}
      >
        {items.map(({ key, href, label, sub, icon: Icon, external, aria }) =>
          href ? (
            <a
              key={key}
              href={href}
              aria-label={aria}
              {...(external && { target: "_blank", rel: "noopener noreferrer" })}
              className={`flex min-h-12 flex-col items-center justify-center rounded-md text-xs font-semibold ${key === "wa" ? (mobile ? "bg-ok text-white" : "border border-ok text-ok") : "border border-line text-ink"}`}
            >
              <Icon size={18} /> {label}
              {sub && <span className="text-[10px] font-medium leading-none">{sub}</span>}
            </a>
          ) : (
            <span key={key} className="flex min-h-12 flex-col items-center justify-center rounded-md border border-dashed border-line text-[11px] text-muted">
              <Icon size={18} /> Sem {key === "mail" ? "e-mail" : key === "tel" ? "telefone" : "número"}
            </span>
          ),
        )}
        {primary && (
          <Link href={primary.href} className="flex min-h-12 flex-col items-center justify-center rounded-md bg-navy text-xs font-semibold text-white">
            <Plus size={18} /> {primary.label}
          </Link>
        )}
      </div>
    </>
  );
}

/** Espaço no fim da página para a barra fixa do celular não cobrir o conteúdo. */
export function ContactActionsSpacer() {
  return <div aria-hidden className="h-16 lg:hidden" />;
}
