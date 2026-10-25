import type { Metadata } from "next";
import { Cabecalho } from "@/components/cabecalho";
import { HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { EMPRESA, whatsapp } from "@/content/empresa";
import { EmailTexto, LinkEmail } from "@/components/email";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como o site da AUDITA trata dados pessoais, conforme a LGPD.",
  alternates: { canonical: "/privacidade/" },
};

/**
 * Política de privacidade do SITE institucional (o que o site realmente faz: sem formulário, sem cookies próprios,
 * sem medição de audiência). A da plataforma de cursos fica em /treinamentos/privacidade. Texto da Etapa 4, para
 * validação do Diretor; a razão social completa no lugar da assinatura depende da pendência da Etapa 5 do briefing.
 */
export default function Privacidade() {
  return (
    <>
      <Cabecalho />
      <main>
        <HeroInterno
          id="privacidade-titulo"
          migalhas={[{ rotulo: "Política de privacidade" }]}
          kicker="LGPD"
          titulo="Política de privacidade do site"
          resumo="Versão 1.0, vigente desde 24/10/2026."
          foto={{ codigo: "IMG-20", descricao: "ambiente de trabalho organizado e seguro" }}
        />
        <section className="secao">
          <article className="container texto-legal">
            <h2>1. Quem é o responsável pelos dados</h2>
            <p>
              O controlador dos dados pessoais tratados neste site é a {EMPRESA.assinatura}, CNPJ {EMPRESA.cnpj}, com endereço na {EMPRESA.endereco}.
              Para assuntos de privacidade, fale pelo e-mail <LinkEmail><EmailTexto /></LinkEmail>, com o assunto &quot;Privacidade&quot;, ou pelo{" "}
              <a href={whatsapp("Olá! Tenho uma dúvida sobre privacidade.")} target="_blank" rel="noopener">WhatsApp {EMPRESA.telefone}</a>.
            </p>

            <h2>2. O que este site coleta</h2>
            <p>
              Este site é informativo. Ele <strong>não tem formulário, não cria contas e não pede dados pessoais</strong>. Quando você clica em
              WhatsApp ou e-mail, a conversa acontece nesses serviços, e usamos o que você nos enviar só para responder e, se for o caso, preparar
              uma proposta (LGPD, art. 7º, V: procedimentos preliminares a um contrato, a seu pedido).
            </p>
            <p>
              Como qualquer site, o servidor registra dados técnicos de acesso: endereço IP, data e hora, página visitada e tipo de navegador.
              Esses registros servem para segurança e funcionamento do site e são guardados por 6 meses, como exige o Marco Civil da Internet
              (art. 15).
            </p>

            <h2>3. Cookies e serviços de terceiros</h2>
            <ul>
              <li>O site <strong>não usa cookies próprios</strong>, de publicidade ou de medição de audiência.</li>
              <li>
                A <strong>Cloudflare</strong>, que protege e entrega o site, pode gravar cookies técnicos de segurança (proteção contra robôs).
              </li>
              <li>
                O botão do <strong>VLibras</strong> (tradutor de Libras do Governo Federal) é carregado dos servidores do gov.br, que recebem dados
                técnicos de acesso, como o IP.
              </li>
              <li>
                Links para o WhatsApp, o e-mail e o mapa abrem serviços de terceiros (Meta, Microsoft e Google), com políticas próprias.
              </li>
            </ul>

            <h2>4. Com quem os dados ficam</h2>
            <p>
              O site fica em servidor da <strong>Contabo</strong>, na França (União Europeia), e passa pela <strong>Cloudflare</strong>. Alguns desses
              fornecedores tratam dados fora do Brasil; nesses casos a transferência segue o art. 33 da LGPD. Não vendemos dados pessoais.
            </p>

            <h2>5. Outras áreas da AUDITA</h2>
            <p>
              A <a href={`${EMPRESA.treinamentos}/privacidade`}>plataforma de cursos EAD</a> tem política de privacidade própria, porque trata dados de cadastro,
              compra e estudo. O Audita PRO e o Audita HUB são áreas exclusivas de clientes, regidas pelos contratos de cada plataforma.
            </p>

            <h2>6. Seus direitos</h2>
            <p>
              Você pode pedir confirmação e acesso aos seus dados, correção, anonimização, bloqueio ou eliminação de dados desnecessários,
              portabilidade, informação sobre compartilhamentos e revisão de decisões automatizadas (LGPD, art. 18), pelo canal do item 1.
              Respondemos em até 15 dias e podemos pedir uma confirmação de identidade. Você também pode reclamar à{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener">ANPD</a>.
            </p>

            <h2>7. Segurança</h2>
            <p>O site usa conexão criptografada (HTTPS) e não guarda dados pessoais além dos registros técnicos de acesso do item 2.</p>

            <h2>8. Alterações</h2>
            <p>Esta política pode ser atualizada. A versão vigente fica sempre nesta página, com a data de vigência.</p>
          </article>
        </section>
      </main>
      <Rodape />
    </>
  );
}
