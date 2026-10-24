import { EMPRESA } from "./empresa";
import { FAMILIAS } from "./servicos";

/** Menu principal (briefing, seção 8). `externo` abre em nova aba com o aviso de link externo. */
export type ItemMenu = { rotulo: string; href: string; externo?: boolean };
export type GrupoMenu = { rotulo: string; itens: ItemMenu[] };

export const MENU: GrupoMenu[] = [
  {
    rotulo: "A AUDITA",
    itens: [
      { rotulo: "Quem somos", href: "/a-audita/#quem-somos" },
      { rotulo: "Missão, visão e valores", href: "/a-audita/#missao-visao-valores" },
      { rotulo: "Por que a AUDITA", href: "/a-audita/#por-que-a-audita" },
      { rotulo: "Como trabalhamos", href: "/a-audita/#como-trabalhamos" },
    ],
  },
  { rotulo: "Soluções", itens: FAMILIAS.map((f) => ({ rotulo: f.nome, href: `/solucoes/${f.slug}/` })) },
  {
    rotulo: "Plataformas",
    itens: [
      { rotulo: "Audita PRO", href: "/audita-pro/" },
      { rotulo: "Audita HUB", href: "/audita-hub/" },
    ],
  },
  {
    rotulo: "Cursos EAD",
    itens: [
      { rotulo: "Conheça os cursos", href: "/cursos/" },
      { rotulo: "Acessar a plataforma", href: EMPRESA.treinamentos },
    ],
  },
];
