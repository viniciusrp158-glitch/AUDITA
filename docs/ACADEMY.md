# Audita Academy: plataforma de treinamentos

Em 16/11/2026, o Diretor (Vinícius) renomeou a plataforma de treinamentos para **Audita Academy**, com logo próprio. Ele
também aprovou o planejamento e o protótipo. Os endereços continuam em `audita.seg.br/treinamentos` (área do aluno,
pasta `aluno/`). Os endereços curtos `/cursos`, `/auditaacademy` e `/academy` levam até lá; quem faz esse
redirecionamento é o Nginx do site (`deploy/vps/site/nginx.conf`).

- Planejamento: https://claude.ai/artifact/Uem4yq2WjvZzBUwmxKthqu
- Protótipo aprovado: https://claude.ai/artifact/QtD8ubuCE3b9fKF5TW8F2a

## Situação das etapas

| Etapa | Entrega | Situação |
|---|---|---|
| 0 | Protótipo navegável | Aprovado (16/11/2026) |
| 1 | Marca: logo, topo, rodapé, telas de acesso, títulos e e-mail de convite | No ar desde 16/11/2026 (S9) |
| 2 | Página inicial da Academy, catálogo, página do curso, endereços curtos e item no site institucional | No ar desde 16/11/2026 (S9) |
| 3 | Compra com indicador de etapas e retorno do pagamento | No ar desde 16/11/2026 (S9) |
| 4 | Meus cursos com "Continuar de onde parei" e progresso; logo na sala de aula | No ar desde 16/11/2026 (S9) |
| 5 | Menu do aluno (iniciais, sino, barra inferior no celular), Meu Perfil, WhatsApp e Histórico de cursos | No ar desde 17/11/2026 (S10). Migração `20261116120000_a5_academy_aluno.sql` aplicada no desenvolvimento e na produção |
| 6 | Financeiro, comprovante e relatório anual (imprimir ou salvar em PDF) | No ar desde 17/11/2026 (S10) |
| 7 | Notificações (automáticas, aviso de prazo calculado na leitura) e comunicados em `/empresa/treinamentos/comunicados` | Notificações no ar desde 17/11/2026 (S10). A tela de comunicados entrou no ar com a publicação do sistema de 19/11/2026 (`audita-sistema:20261119-celular3`, feita pela sessão do Sistema de Operação). Envio por e-mail ainda não existe (decisão do Diretor) |

Os dados de apresentação que não ficam no banco (capa e área de cada curso, WhatsApp) estão em `aluno/src/lib/academy.ts`.
Curso sem capa usa `aluno/public/capas/padrao.webp`. Curso sem área cadastrada não mostra o selo de área.

## Decisões do Diretor ainda em aberto

- Logo no certificado: Audita Academy, AUDITA ou os dois. Até a decisão, o certificado continua com o da AUDITA.
- Dados obrigatórios para emitir o certificado.
- Notificações também por e-mail.
- Cupom de desconto, botão "Avise-me" e amostra grátis do Módulo 01.
- Assunto do e-mail de convite: hoje é "Seu acesso aos treinamentos AUDITA". Para mudar, é preciso alterar
  `GOTRUE_MAILER_SUBJECTS_INVITE` e recriar o `audita-auth`, que também atende o login do sistema.

## Mudanças de banco (etapas 5 a 7)

Feitas na migração `20261116120000_a5_academy_aluno.sql` (teste `tests/integration/academy-a5.test.ts`). Aplicada na produção em 17/11/2026, sozinha: a `20261114120000_p1_prospect.sql` é de outra frente e continua fora da produção. Diferença em relação ao plano: o aviso de prazo é calculado na leitura (sem `pg_cron`).

Plano original:

Regras: migração nova em `supabase/migrations`, primeiro no desenvolvimento (`supabase-audita-dev`), com RLS e nada para
`anon`, e trilha em `audit_log`.

### Etapa 5: Meu Perfil e Histórico

- `audita.training_students`: novas colunas, todas opcionais:
  - `birth_date date`;
  - `job_title text`;
  - `address_cep text` (8 dígitos), `address_street`, `address_number`, `address_complement`, `address_district`,
    `address_city`, `address_state` (UF, 2 letras);
  - `email_notices boolean not null default true`.
- Função `audita.training_update_my_profile(...)` (`security definer`, só para o próprio aluno, `auth.uid() = user_id`):
  - altera `full_name`, `cpf`, `phone`, `company`, `job_title`, `birth_date`, endereço e `email_notices`;
  - nunca altera `email`, `status`, `source` nem `is_test`;
  - valida o CPF com `audita.is_valid_cpf`.
- O certificado já emitido não muda: os dados ficam congelados na emissão. A correção de nome continua com a gestão.
- Histórico: as tentativas e os certificados já são lidos pelas funções do aluno. Falta só uma função de leitura
  `audita.training_my_history(p_enrollment_id)`, que devolva por módulo a data de conclusão, a melhor nota, o número de
  tentativas e a nota da avaliação final. Ela usa a mesma condição de acesso da RLS.

### Etapa 6: Financeiro

- Hoje o aluno não lê `audita.training_orders`: a vitrine passa só pela função `vitrine`.
- Nova política de leitura, ou função `audita.training_my_orders()`, para devolver ao aluno só os pedidos dele:
  - critério: `buyer_email = lower(auth.email())`, ou o `student_id` da matrícula ligada ao pedido;
  - colunas: data, curso, valor, forma de pagamento (`mp_payment_method`), situação e, no pedido pendente e no prazo,
    o link de pagamento já existente;
  - sem token público e sem dados do Mercado Pago além desses.
- Relatório anual e comprovante:
  - página para imprimir ou salvar em PDF, como o certificado, para não acrescentar bibliotecas ao `package.json`
    compartilhado;
  - dados do vendedor vindos de `training_sales_settings` (função `vitrine`, ação `loja`);
  - título "Relatório de pagamentos", sem prometer dedução no imposto de renda: cursos livres não entram na dedução de
    instrução. Confirmar com o contador.

### Etapa 7: Notificações

- `audita.training_notifications`:
  - colunas: `id`, `student_id` (nulo = comunicado), `course_id` (nulo = todos os alunos), `kind`, `title`, `body`,
    `link`, `created_at`, `created_by`;
  - valores de `kind`: `pagamento`, `liberado`, `modulo`, `avaliacao`, `certificado`, `prazo`, `curso_novo`,
    `comunicado`.
- `audita.training_notification_reads (notification_id, student_id, read_at)`, com chave dupla.
- RLS: o aluno lê os avisos dele e os comunicados dos cursos em que tem matrícula em vigor. Ele só grava a própria
  leitura, pela função `training_mark_read`.
- Avisos automáticos:
  - gatilhos ou chamadas nas funções que já existem: liberação do pedido, matrícula, conclusão de módulo, correção de
    tentativa e emissão do certificado;
  - aviso de prazo de acesso: `pg_cron` diário, 30 e 7 dias antes de `access_until`.
- Gestão: tela "Comunicados" na aba Treinamentos de `/empresa`, com título, texto, link e destino (todos os alunos ou
  um curso). Essa tela é da sessão do Sistema de Operação.
- E-mail dos avisos: só se o Diretor aprovar. Usa o Brevo, que já está configurado, e respeita `email_notices`.
