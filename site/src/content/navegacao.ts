import { EMPRESA } from "./empresa";
import { FAMILIAS } from "./servicos";

/** Menu principal (briefing, seção 8). `externo` abre em nova aba com o aviso de link externo. */
export type ItemMenu = { rotulo: string; href: string; externo?: boolean };
export type GrupoMenu = { rotulo: string; itens: ItemMenu[] };

export const MENU: GrupoMenu[] = [
  {
    rotulo: "A AUDITA",
    itens: [
      { rotulo: "Quem somos", href: "/#quem-somos" },
      { rotulo: "Missão, visão e valores", href: "/#missao-visao-valores" },
      { rotulo: "Por que a AUDITA", href: "/#por-que-a-audita" },
      { rotulo: "Como trabalhamos", href: "/#como-trabalhamos" },
    ],
  },
  { rotulo: "Soluções", itens: FAMILIAS.map((f) => ({ rotulo: f.nome, href: `/solucoes/${f.slug}/` })) },
  {
    rotulo: "Plataformas",
    itens: [
      { rotulo: "Audita PRO", href: "/#plataformas" },
      { rotulo: "Audita HUB", href: "/#plataformas" },
    ],
  },
  {
    rotulo: "Cursos EAD",
    itens: [
      { rotulo: "Conheça os cursos", href: "/#cursos" },
      { rotulo: "Acessar a plataforma", href: EMPRESA.treinamentos },
    ],
  },
];
