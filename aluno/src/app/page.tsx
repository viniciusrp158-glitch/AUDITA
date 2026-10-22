import { redirect } from "next/navigation";

/** audita.seg.br/treinamentos: por enquanto leva à área do aluno (a vitrine de cursos entra numa etapa seguinte). */
export default function Home() {
  redirect("/meus-cursos");
}
