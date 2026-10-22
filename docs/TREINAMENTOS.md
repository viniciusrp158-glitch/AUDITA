# Plataforma de Treinamentos (EAD) do Sistema AUDITA

Pedido do Leandro, com o Diretor (Vinícius), em 22/10/2026. Os treinamentos serão vendidos ao público depois. Cada
treinamento é dividido em módulos, e cada módulo segue **Apostila/e-book → Videoaula → Avaliação**. O Módulo 01 é
sempre a Ambientação. Todo treinamento tem ficha técnica, plano pedagógico e, por módulo, material do aluno, material do
instrutor e slides. O pacote de referência é o curso **L01**, "Segurança do Trabalho: Primeiros Passos para um Ambiente
Seguro", v1.2: 7 módulos, 39 PDFs e 102 slides em PNG, com 34 questões objetivas e 11 atividades abertas (códigos `Q`,
`A`, `C` e `R`).

## Decisões

| Decisão | Valor |
|---|---|
| Vídeos | **YouTube "não listado"**, publicados pelo Vinícius. O sistema guarda só o link e incorpora o vídeo. Nada de vídeo na VPS. |
| Área do aluno e vitrine | **`audita.seg.br/treinamentos`** (confirmado pelo Diretor em 22/10/2026): site separado do sistema (pasta `aluno/`), mesmo banco, sessão própria (cookie `audita-aluno`, só em `/treinamentos`). A gestão continua em `audita.seg.br/empresa`. |
| Alunos | Conta própria, separada dos usuários do sistema (nunca entra em `app_users`). Três formas de criar: matrícula individual e em lote (planilha CSV ou texto colado) pela aba Alunos, com convite por e-mail para criar a senha; e cadastro com compra pela vitrine (etapas 5 e 6). |
| Visual | O padrão novo vale **só dentro da aba Treinamentos**. O menu lateral e as demais abas não mudam. Na área do aluno, as etapas ficam só na lateral, sem quadros acima do conteúdo. |
| Base técnica | Mesmo padrão da Biblioteca (I7): arquivos privados com SHA-256, links assinados e nada excluído. O modelo segue o motor de treinamentos do Audita PRO (versões congeladas), sem tocar no PRO. |

## Etapas

| Etapa | Conteúdo | Situação |
|---|---|---|
| 0 | Protótipo visual com o L01 e as decisões acima | Aprovado pelo Diretor (22/10/2026) |
| **1** | **Aba Treinamentos:** cadastro, ficha técnica, versões, módulos e materiais (aluno, instrutor, slides), venda (preço/prazo) | **Entregue na branch `feat/t1-treinamentos-base` (22/10/2026)** |
| **2a** | **Alunos e matrículas** (individual e em lote, convite por e-mail) e **área do aluno** em `/treinamentos`: entrar, criar senha, esqueci a senha e Meus cursos | **Em produção desde 22/10/2026 (branch `feat/t2-area-do-aluno`)** |
| 2b | Player do curso: apostila, vídeo do YouTube, progresso e módulos em sequência | — |
| 2c | Importador do pacote `.zip` e banco de questões: tempo de prova, tentativas, nota mínima e retorno ao aluno | — |
| 3 | Videoaulas: link do YouTube validado e player incorporado (o campo do link já existe na etapa 1) | — |
| 4 | Área do aluno: progresso, travamento sequencial, prova com cronômetro, certificado com código de verificação | — |
| 5 | Vitrine pública e conta do aluno | — |
| 6 | Vendas: Pix e cartão, liberação automática, cupons e lançamento no Caixa | — |
| 7 | Gestão do dia a dia e indicadores | — |

## Etapa 1: modelo de dados (`supabase/migrations/20261022180000_t1_treinamentos.sql`)

- **`audita.training_courses`:**
  - código permanente (ex.: `L01`) e título;
  - **preço** e **prazo de acesso**, que valem para todas as versões e mudam a qualquer momento (preço nulo = PENDENTE);
  - situação ativo/inativo.
- **`audita.training_versions`:**
  - a ficha técnica: título, resumo, modalidade, carga horária, público, pré-requisitos, objetivo, metodologia,
    avaliação e certificação, recursos, referências, aviso e instrutor;
  - situação: `rascunho` → `publicada` → `substituida` (ou `cancelada`);
  - no máximo um rascunho e uma publicada por treinamento;
  - só o rascunho pode ser editado; a publicada fica congelada.
- **`audita.training_modules`:**
  - posição (o Módulo 01 é a Ambientação, obrigatória e sempre primeira), título, objetivo, tópicos, minutos de
    vídeo/leitura/atividades e link do YouTube (validado);
  - a ordem só muda pela função de mover;
  - inativação lógica.
- **`audita.training_files`:**
  - arquivos privados no bucket `audita-treinamentos` (50 MB), com SHA-256;
  - público calculado: **aluno** (apostila, ficha técnica) ou **equipe** (roteiro, gabarito, avaliação de origem,
    slides, plano pedagógico, orientações, gabarito consolidado);
  - um arquivo ativo por tipo; slides em imagem são vários, ordenados pelo número do nome;
  - trocar um arquivo = enviar um novo; o anterior fica "removido".
- **Funções:**
  - `training_create_course`: cria o treinamento, a versão em rascunho e o M01;
  - `training_add_module`, `training_move_module`;
  - `training_publish_version`: exige carga horária, um módulo além da Ambientação e apostila em todo módulo ativo;
  - `training_cancel_version`, com motivo;
  - `training_new_version`: copia a ficha, os módulos e os arquivos da publicada;
  - `log_training_download`.
- **Segurança:**
  - RLS em todas as tabelas, só administradores;
  - nada para `anon`;
  - gatilhos impedem alterar versão publicada, arquivo registrado, código e ordem fora do fluxo;
  - trilha em `audit_log`.

## Etapa 1: telas (`src/app/(app)/treinamentos`)

- `/treinamentos`: lista com busca.
- `/treinamentos/novo`: código, versão e título.
- `/treinamentos/[id]`: abas
  - **Módulos e materiais**, com o checklist "Antes de publicar";
  - **Ficha técnica**;
  - **Documentos do treinamento**;
  - **Venda e preço**;
  - **Versões**: publicar, cancelar e nova versão.
- `/treinamentos/[id]/modulo/[moduleId]`:
  - Apostila, Videoaula e Avaliação;
  - material do instrutor e slides;
  - dados do módulo e link do YouTube;
  - subir, descer e inativar.
- `/treinamentos/arquivo/[fileId]`: abre o arquivo por link assinado de 60 s, com registro na trilha.

## Etapa 2a: alunos, matrículas e área do aluno

- **Migração `20261023090000_t2_alunos.sql`:**
  - `training_students`: aluno com conta própria, nome, e-mail permanente, CPF/empresa/telefone opcionais e origem;
  - `training_enrollments`: aluno × treinamento, presa à **versão publicada** na matrícula, com prazo de acesso (padrão =
    prazo do treinamento) e situação ativa/suspensa/cancelada/concluída;
  - `training_progress` (para a etapa 2b).
- **Regras:**
  - matrícula só pela função `training_enroll` (administrador);
  - o aluno vê só o próprio cadastro, as próprias matrículas e o conteúdo **do aluno** (apostila, ficha técnica) das
    versões em que está matriculado e dentro do prazo, inclusive os arquivos no armazenamento;
  - roteiro, gabarito e slides nunca aparecem para o aluno;
  - prazo vencido, matrícula suspensa ou aluno inativo cortam o acesso.
- **Função `alunos` (Edge Function):**
  - cria a conta e envia o **convite** (modelo `deploy/vps/email-templates/convite-aluno.html`, assunto "Seu acesso aos
    treinamentos AUDITA") com um link para `/treinamentos/auth/confirm`;
  - reaproveita a conta de quem já tem uma (sem e-mail) e matricula até 500 alunos por envio, com resultado por linha;
  - informa a situação (convite pendente/senha criada/último acesso) e reenvia o convite.
- **Gestão:** aba **Alunos** no treinamento:
  - matrícula individual, com opção de cortesia;
  - matrícula em lote (CSV ou texto colado, com prévia);
  - lista com busca e as ações reenviar convite, suspender/reativar, alterar prazo e cancelar com motivo.
- **Área do aluno (`aluno/`):**
  - páginas `/treinamentos/entrar`, `/esqueci`, `/auth/confirm`, `/definir-senha` e `/meus-cursos`;
  - imagem pelo `deploy/vps/aluno/Dockerfile`, que compila com `npx next build aluno`.
- **Publicação na VPS (feita em 22/10/2026):**
  - migração aplicada;
  - função `alunos` em `volumes/functions`;
  - modelo e assunto do convite no Auth (`deploy/vps/docker-compose.vps.yml`);
  - container `audita-aluno` (`deploy/vps/web/docker-compose.yml`, `AUDITA_ALUNO_TAG`);
  - Nginx com `location ^~ /treinamentos` (`deploy/vps/nginx-audita-sistema*.conf`);
  - nova imagem do sistema.
