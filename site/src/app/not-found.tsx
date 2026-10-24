import { Cabecalho } from "@/components/cabecalho";
import Link from "next/link";
import { Rodape } from "@/components/rodape";

export default function NaoEncontrada() {
  return (
    <>
      <Cabecalho />
      <main>
        <section className="hero hero--interna">
          <div className="container" style={{ position: "relative" }}>
            <h1 className="t1">Página não encontrada</h1>
            <p className="texto-grande medida" style={{ margin: "20px 0 0" }}>
              O endereço não existe ou a página ainda está sendo construída. A equipe AUDITA entra pelo sistema em audita.seg.br/empresa.
            </p>
            <div className="acoes">
              <Link className="btn btn--principal" href="/">Ir para a página inicial</Link>
              <a className="btn btn--contorno-claro" href="/empresa">Entrar no sistema</a>
            </div>
          </div>
        </section>
      </main>
      <Rodape />
    </>
  );
}
