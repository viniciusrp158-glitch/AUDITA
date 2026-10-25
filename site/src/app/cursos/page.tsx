import type { Metadata } from "next";
import Link from "next/link";
import { Info } from "lucide-react";
import { Cabecalho } from "@/components/cabecalho";
import { GradeCursos } from "@/components/grade-cursos";
import { HeroInterno } from "@/components/pagina";
import { Rodape } from "@/components/rodape";
import { AVISO_CURSO_LIVRE, cursosPublicados } from "@/content/cursos";
import { EMPRESA } from "@/content/empresa";

export const metadata: Metadata = {
  title: "Cursos EAD",
  description: "Cursos livres de capacitação da AUDITA, EAD e com certificado de conclusão. Compra e acesso na plataforma de treinamentos.",
  alternates: { canonical: "/cursos/" },
};

/** /cursos: vitrine dos cursos publicados, com filtro por área, e links para a plataforma em /treinamentos. */
export default function Cursos() {
  return (
    <>
      <Cabecalho ativo="Cursos EAD" />
      <main>
        <HeroInterno
          id="cursos-titulo"
          migalhas={[{ rotulo: "Cursos EAD" }]}
          kicker="Capacitação AUDITA"
          titulo={<>Cursos <span className="marca-texto">EAD</span></>}
          resumo="Capacitação que gera cultura de segurança. Cursos livres, no seu ritmo, com certificado de conclusão."
          foto={{ codigo: "IMG-26", descricao: "pessoa assistindo aula no celular ou notebook" }}
        >
          <div className="acoes">
            <a className="btn btn--principal btn--bloco" href={`${EMPRESA.treinamentos}/cursos`}>Comprar na plataforma</a>
            <a className="btn btn--contorno-claro btn--bloco" href={`${EMPRESA.treinamentos}/entrar`}>Já sou aluno</a>
          </div>
        </HeroInterno>

        <section className="secao" aria-label="Cursos publicados">
          <div className="container">
            <p className="aviso" style={{ margin: "0 0 32px", maxWidth: "none" }}>
              <Info aria-hidden="true" size={20} style={{ flex: "none", marginTop: 1 }} />
              <span>{AVISO_CURSO_LIVRE}</span>
            </p>
            <GradeCursos cursos={cursosPublicados()} />
          </div>
        </section>

        <section className="secao secao--cinza" aria-labelledby="empresa-titulo">
          <div className="container grade grade--2 grade--meio">
            <div>
              <h2 id="empresa-titulo" className="t2">Treinamento para a sua equipe</h2>
              <p className="medida" style={{ margin: "16px 0 0" }}>
                Além dos cursos EAD, a AUDITA faz treinamentos in company por turma, conforme a norma e o contexto da sua empresa.
              </p>
              <div className="acoes">
                <Link className="btn btn--escuro btn--bloco" href="/solucoes/treinamentos-in-company/">Ver treinamentos in company</Link>
              </div>
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }} className="lista">
              <li>Certificado de conclusão com mínimo de 7 acertos em 10 na avaliação final</li>
              <li>Estudo no seu ritmo, no celular ou no computador</li>
              <li>Compra e acesso direto na plataforma de treinamentos</li>
            </ul>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
