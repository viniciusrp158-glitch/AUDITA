# Site institucional (audita.seg.br): como atualizar o conteúdo

O site fica na pasta `site/` (Next.js com páginas estáticas) e roda no container `audita-site` da VPS 1. Toda mudança abaixo
vale depois de um novo build e publicação (procedimento em `deploy/vps/README.md`, seção "Site institucional").

## 1. Imagens definitivas (fotos e vídeo)

Coloque cada arquivo em `site/public/images/site/` com o nome **começando pelo código** da tabela. O resto do nome é livre
(`img-02-profissional-com-gestor.jpg`). No build, a imagem entra sozinha no lugar do espaço marcado; sem o arquivo, o
espaço continua com o código e a descrição.

- Formatos: `.avif`, `.webp`, `.jpg` ou `.png`. Se houver mais de um, vale nessa ordem.
- Fotos de seção: 4:3, mínimo 1200 × 900. Hero: 16:9, mínimo 2560 × 1440. Hero no celular (`img-01m`): 4:5 ou 9:16, mínimo
  1080 × 1350. Exporte em WebP ou AVIF de até ~300 KB cada.
- **Vídeo do hero:** `img-01.mp4` (10 a 15 s, mudo, até 3 MB) e uma foto `img-01.*` como pôster. O vídeo não toca para quem
  ativa "reduzir movimento" nem em conexão lenta (nesses casos aparece a foto).
- Fotos sempre com **EPI correto e conduta segura**. Rostos da equipe da AUDITA não aparecem.

| Código | Onde aparece | O que mostrar (briefing) |
|---|---|---|
| `img-01` / `img-01m` | Home, hero (computador / celular) | Profissional de capacete conferindo um tablet em ambiente industrial |
| `img-02` | Home "Quem somos" e A AUDITA | Profissional com EPI conversando com gestor em ambiente de trabalho real |
| `img-03` | Home "Nossas soluções" e página de SST | Inspeção de campo com EPI |
| `img-04` | Home "Nossas soluções" e página de Meio Ambiente | Coleta seletiva ou resíduos em ambiente industrial |
| `img-05` | Home "Nossas soluções" e página de SGI | Auditoria com checklist e documentos |
| `img-08` a `img-15` | Home "O que resolvemos" (carrossel e fundo) | Visita técnica · documentos organizados · treinamento em sala · mapa de riscos · reunião de CIPA ou brigada · auditoria interna · quadro de prazos e plano de ação · tablet com sistema |
| `img-16` | Home "Cursos EAD" | Pessoa estudando no notebook |
| `img-17` | Home "Missão, visão e valores" (fundo) | Paisagem com indústria e vegetação |
| `img-18` | Home "Fale conosco" e Contato | Aperto de mãos entre profissional com capacete e gestor |
| `img-19` | Rodapé (fundo) | Foto aérea de área industrial com vegetação |
| `img-20` | A AUDITA (topo) e Privacidade | Ambiente de trabalho organizado e seguro, sem rostos identificáveis |
| `img-21` / `img-22` / `img-23` | Topo das páginas de SST / Meio Ambiente / SGI e Soluções | Trabalhador com EPI em inspeção / gestão de resíduos / auditor com tablet e gestor |
| `img-26` | Cursos EAD (topo) | Pessoa assistindo aula no celular ou notebook |
| `img-27` | Contato (topo) | Fachada ou ambiente de Sorocaba, ou foto industrial genérica |
| `capa-l01`, `capa-l02`… | Cards dos cursos | Capa do curso no padrão AUDITA |

As páginas do Audita PRO e do Audita HUB já usam as telas reais enviadas em 25/10/2026 (`site/public/images/plataformas`,
textos em `site/src/content/plataformas.ts`). Não use imagens em que apareça o nome do Diretor.

## 2. Redes sociais

Em `site/src/content/empresa.ts`: preencha a `url` de cada perfil oficial em `REDES_SOCIAIS` e troque
`REDES_SOCIAIS_PUBLICADAS` para `true`. As redes aparecem no rodapé e nos dados estruturados; rede sem URL não aparece.

## 3. Cursos e serviços

- **Cursos:** em `site/src/content/cursos.ts`, marque `publicado: true` só nos cursos que estão à venda na plataforma
  (`/treinamentos/cursos`). Em 25/10/2026: só o L01.
- **Serviços:** em `site/src/content/servicos.ts`, `publicado: false` tira um serviço do site sem mexer no layout. A
  descrição de cada um respeita o "Limite" do Anexo A.

## 4. Tirar a trava dos buscadores (Etapa 7, só com autorização do Diretor)

1. `site/public/robots.txt`: trocar `Disallow: /` por `Allow: /` e acrescentar `Sitemap: https://audita.seg.br/sitemap.xml`.
2. `site/src/app/layout.tsx`: trocar `robots: { index: false, follow: false }` por `robots: { index: true, follow: true }`.
3. `deploy/vps/site/nginx.conf`: apagar as três linhas `add_header X-Robots-Tag "noindex, nofollow" always;`.
4. Tirar a faixa "Prévia do site em construção" em `site/src/components/cabecalho.tsx`.
5. Publicar. Depois, cadastrar `https://audita.seg.br` no Google Search Console (verificação por registro TXT na
   Cloudflare) e enviar o `sitemap.xml`.
