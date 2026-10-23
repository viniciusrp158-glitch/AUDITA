-- AUDITA — T3 Treinamentos: vitrine pública e vendas pelo Mercado Pago (Checkout Pro). Somente acréscimos.
-- Decisões do Diretor (22/10/2026): vitrine aprovada; checkout pelo Mercado Pago.
--
-- Nada é liberado para "anon" no banco (regra 4): a vitrine, a compra e a página do pedido passam pela função "vitrine",
-- e o aviso de pagamento pela função "mercadopago"; as duas usam a chave de serviço, que só existe dentro do Supabase,
-- e chamam as funções abaixo, executáveis apenas por service_role.
-- Textos legais e dados do vendedor não são inventados (regra 6): o administrador preenche; sem eles, a venda não abre.
-- As credenciais do Mercado Pago ficam no Supabase Vault (criptografadas); a tela mostra só o final.

-- ---------------------------------------------------------------------------
-- Treinamento à venda (aparece na vitrine)
-- ---------------------------------------------------------------------------
alter table audita.training_courses add column on_sale boolean not null default false;
comment on column audita.training_courses.on_sale is 'Mostrar na vitrine e aceitar compras (exige versão publicada e preço).';

-- ---------------------------------------------------------------------------
-- Configurações de venda (registro único)
-- ---------------------------------------------------------------------------
create table audita.training_sales_settings (
  id               smallint primary key default 1 check (id = 1),
  sales_enabled    boolean not null default false,
  seller_name      text check (seller_name is null or length(btrim(seller_name)) between 3 and 200),
  seller_document  text check (seller_document is null or audita.is_valid_cnpj(seller_document)),
  support_email    text check (support_email is null or (support_email = lower(support_email) and support_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')),
  support_phone    text check (support_phone is null or support_phone ~ '^\d{10,13}$'),
  require_cpf      boolean not null default true,
  terms_text       text check (terms_text is null or length(terms_text) between 50 and 60000),
  privacy_text     text check (privacy_text is null or length(privacy_text) between 50 and 60000),
  terms_updated_at timestamptz,
  mp_token_hint    text,
  mp_secret_hint   text,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);
comment on table audita.training_sales_settings is 'Vendas dos treinamentos: vendedor, suporte, termos, privacidade e situação da vitrine.';
insert into audita.training_sales_settings (id) values (1);

create or replace function audita.training_sales_settings_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.terms_text is distinct from old.terms_text or new.privacy_text is distinct from old.privacy_text then
    new.terms_updated_at := now();
  end if;
  if (new.mp_token_hint is distinct from old.mp_token_hint or new.mp_secret_hint is distinct from old.mp_secret_hint)
     and not audita.training_flow_on() then
    raise exception 'As credenciais são gravadas pela tela de credenciais' using errcode = '42501';
  end if;
  if new.sales_enabled and (new.seller_name is null or new.seller_document is null or (new.support_email is null and new.support_phone is null)
       or new.terms_text is null or new.privacy_text is null or new.mp_token_hint is null or new.mp_secret_hint is null) then
    raise exception 'Para abrir as vendas, preencha vendedor, CNPJ, contato de suporte, termos, política de privacidade e as credenciais do Mercado Pago'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger training_sales_settings_before_write
  before update on audita.training_sales_settings
  for each row execute function audita.training_sales_settings_before_write();
create trigger training_sales_settings_set_updated_meta
  before update on audita.training_sales_settings
  for each row execute function audita.set_updated_meta();
create trigger training_sales_settings_audit
  after update on audita.training_sales_settings
  for each row execute function audita.log_row_change('id');

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
create table audita.training_orders (
  id                  uuid primary key default gen_random_uuid(),
  public_token        text not null default replace(gen_random_uuid()::text, '-', '') check (public_token ~ '^[0-9a-f]{32}$'),
  course_id           uuid not null references audita.training_courses (id) on delete restrict,
  version_id          uuid not null references audita.training_versions (id) on delete restrict,
  course_code         text not null,
  course_title        text not null,
  buyer_name          text not null check (length(btrim(buyer_name)) between 3 and 160),
  buyer_email         text not null check (buyer_email = lower(buyer_email) and buyer_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  buyer_cpf           text check (buyer_cpf is null or audita.is_valid_cpf(buyer_cpf)),
  buyer_phone         text check (buyer_phone is null or buyer_phone ~ '^\d{10,13}$'),
  amount              numeric(12, 2) not null check (amount > 0),
  currency            text not null default 'BRL' check (currency = 'BRL'),
  access_days         integer,
  status              text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado', 'estornado')),
  mp_preference_id    text,
  mp_payment_id       text,
  mp_status           text,
  mp_status_detail    text,
  mp_payment_method   text,
  terms_accepted_at   timestamptz not null,
  terms_version       timestamptz,
  student_id          uuid references audita.training_students (id) on delete restrict,
  enrollment_id       uuid references audita.training_enrollments (id) on delete restrict,
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table audita.training_orders is 'Pedidos da vitrine (Mercado Pago). Gravados só pelas funções vitrine/mercadopago; matrícula automática na aprovação.';
create index training_orders_course_idx on audita.training_orders (course_id, created_at desc);
create index training_orders_email_idx on audita.training_orders (buyer_email);
create unique index training_orders_payment_unique on audita.training_orders (mp_payment_id) where mp_payment_id is not null;

create trigger training_orders_audit
  after insert or update on audita.training_orders
  for each row execute function audita.log_row_change('id', 'course_id');

-- ---------------------------------------------------------------------------
-- Credenciais do Mercado Pago (Supabase Vault)
-- ---------------------------------------------------------------------------
create or replace function audita.training_set_payment_secret(p_kind text, p_value text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_value text := btrim(coalesce(p_value, ''));
  v_id uuid;
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  if p_kind not in ('mp_access_token', 'mp_webhook_secret') then
    raise exception 'Credencial inválida' using errcode = '22023';
  end if;
  if length(v_value) < 16 or length(v_value) > 500 or v_value ~ '\s' then
    raise exception 'Cole a credencial completa, como aparece no Mercado Pago' using errcode = '23514';
  end if;
  if p_kind = 'mp_access_token' and v_value !~ '^(APP_USR|TEST)-' then
    raise exception 'O Access Token do Mercado Pago começa com APP_USR- (produção) ou TEST- (teste)' using errcode = '23514';
  end if;
  v_name := 'audita_' || p_kind;
  select s.id into v_id from vault.secrets s where s.name = v_name;
  if v_id is null then
    perform vault.create_secret(v_value, v_name, 'AUDITA — vendas dos treinamentos (Mercado Pago)');
  else
    perform vault.update_secret(v_id, v_value);
  end if;
  perform set_config('audita.training_flow', 'on', true);
  if p_kind = 'mp_access_token' then
    update audita.training_sales_settings
       set mp_token_hint = (case when v_value like 'TEST-%' then 'TESTE ' else '' end) || '••••' || right(v_value, 4)
     where id = 1;
  else
    update audita.training_sales_settings set mp_secret_hint = '••••' || right(v_value, 4) where id = 1;
  end if;
  perform set_config('audita.training_flow', 'off', true);
end;
$$;

-- Leitura da credencial: só a chave de serviço (funções vitrine e mercadopago)
create or replace function audita.training_payment_secret(p_kind text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return (select s.decrypted_secret from vault.decrypted_secrets s where s.name = 'audita_' || p_kind);
end;
$$;

-- ---------------------------------------------------------------------------
-- Vitrine (chamadas pela função "vitrine")
-- ---------------------------------------------------------------------------
create or replace function audita.training_store_open()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.sales_enabled from audita.training_sales_settings s where s.id = 1), false);
$$;

-- Cursos à venda: ativos, com versão publicada e preço
create or replace function audita.training_catalog(p_code text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', c.course_code, 'title', v.title, 'summary', v.summary, 'modality', v.modality,
           'workload_minutes', v.workload_minutes, 'audience', v.audience, 'prerequisites', v.prerequisites,
           'general_objective', v.general_objective, 'methodology', v.methodology, 'assessment_rules', v.assessment_rules,
           'important_notice', v.important_notice, 'instructor_name', v.instructor_name, 'version_label', v.version_label,
           'price', c.price, 'access_days', c.access_days,
           'modules', (select coalesce(jsonb_agg(jsonb_build_object(
                          'position', m.position, 'title', m.title, 'objective', m.objective,
                          'video_minutes', m.video_minutes, 'reading_minutes', m.reading_minutes, 'activity_minutes', m.activity_minutes,
                          'has_video', m.video_url is not null) order by m.position), '[]'::jsonb)
                         from audita.training_modules m where m.version_id = v.id and m.status = 'ativo'),
           'final', (select jsonb_build_object('pass_score', a.pass_score, 'objectives',
                            (select count(*) from audita.training_questions q where q.assessment_id = a.id and q.status = 'ativo' and q.kind = 'objetiva'),
                            'max_attempts', a.max_attempts)
                       from audita.training_assessments a join audita.training_modules m on m.id = a.module_id
                      where a.version_id = v.id and a.pass_score is not null and m.status = 'ativo' limit 1)
         ) order by c.course_code), '[]'::jsonb)
    from audita.training_courses c
    join audita.training_versions v on v.course_id = c.id and v.status = 'publicada'
   where c.status = 'ativo' and c.on_sale and c.price is not null
     and (p_code is null or c.course_code = upper(btrim(p_code)));
$$;

-- Dados públicos do vendedor e textos legais
create or replace function audita.training_store_info()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', s.sales_enabled, 'seller_name', s.seller_name, 'seller_document', s.seller_document,
                            'support_email', s.support_email, 'support_phone', s.support_phone, 'require_cpf', s.require_cpf,
                            'terms_text', s.terms_text, 'privacy_text', s.privacy_text, 'terms_updated_at', s.terms_updated_at)
    from audita.training_sales_settings s where s.id = 1;
$$;

-- Novo pedido (antes de ir ao Mercado Pago)
create or replace function audita.training_order_create(
  p_code text, p_name text, p_email text, p_cpf text, p_phone text, p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s audita.training_sales_settings;
  c audita.training_courses;
  v audita.training_versions;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  o audita.training_orders;
begin
  select * into s from audita.training_sales_settings where id = 1;
  if not s.sales_enabled then
    raise exception 'As vendas estão fechadas no momento' using errcode = '23514';
  end if;
  select * into c from audita.training_courses where course_code = upper(btrim(coalesce(p_code, ''))) and status = 'ativo' and on_sale and price is not null;
  if not found then
    raise exception 'Curso não disponível para compra' using errcode = 'P0002';
  end if;
  select * into v from audita.training_versions where course_id = c.id and status = 'publicada';
  if not found then
    raise exception 'Curso não disponível para compra' using errcode = 'P0002';
  end if;
  if not coalesce(p_accept, false) then
    raise exception 'Para comprar, aceite os termos de uso e a política de privacidade' using errcode = '23514';
  end if;
  if length(btrim(coalesce(p_name, ''))) < 5 or btrim(p_name) !~ '\s' then
    raise exception 'Informe seu nome completo' using errcode = '23514';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
    raise exception 'Informe um e-mail válido' using errcode = '23514';
  end if;
  if s.require_cpf and v_cpf is null then
    raise exception 'Informe o CPF' using errcode = '23514';
  end if;
  if v_cpf is not null and not audita.is_valid_cpf(v_cpf) then
    raise exception 'CPF inválido' using errcode = '23514';
  end if;
  if v_phone is not null and v_phone !~ '^\d{10,13}$' then
    raise exception 'Telefone inválido (DDD + número)' using errcode = '23514';
  end if;
  if exists (select 1 from audita.training_enrollments e join audita.training_students st on st.id = e.student_id
              where st.email = v_email and e.course_id = c.id and e.status in ('ativa', 'suspensa')) then
    raise exception 'Este e-mail já tem acesso a este curso. Entre na área do aluno.' using errcode = '23505';
  end if;
  insert into audita.training_orders (course_id, version_id, course_code, course_title, buyer_name, buyer_email, buyer_cpf, buyer_phone,
                                      amount, access_days, terms_accepted_at, terms_version)
  values (c.id, v.id, c.course_code, v.title, btrim(p_name), v_email, v_cpf, v_phone, c.price, c.access_days, now(), s.terms_updated_at)
  returning * into o;
  return jsonb_build_object('order_id', o.id, 'token', o.public_token, 'amount', o.amount, 'code', o.course_code,
                            'title', o.course_title, 'email', o.buyer_email, 'name', o.buyer_name, 'cpf', o.buyer_cpf);
end;
$$;

create or replace function audita.training_order_set_preference(p_order_id uuid, p_preference text)
returns void
language sql
security definer
set search_path = ''
as $$
  update audita.training_orders set mp_preference_id = p_preference, updated_at = now() where id = p_order_id and status = 'pendente';
$$;

-- Resultado do pagamento (dados lidos da API do Mercado Pago pela função "mercadopago").
-- Confere valor e moeda; devolve se é preciso liberar o acesso.
create or replace function audita.training_order_apply_payment(p_order_id uuid, p_payment jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o audita.training_orders;
  v_mp text := p_payment->>'status';
  v_status text;
begin
  select * into o from audita.training_orders where id = p_order_id for update;
  if not found then
    raise exception 'Pedido não encontrado' using errcode = 'P0002';
  end if;
  if (p_payment->>'transaction_amount')::numeric is distinct from o.amount or coalesce(p_payment->>'currency_id', 'BRL') <> o.currency then
    raise exception 'Valor do pagamento diferente do pedido' using errcode = '23514';
  end if;
  v_status := case
    when v_mp = 'approved' then 'aprovado'
    when v_mp in ('refunded', 'charged_back') then 'estornado'
    when v_mp in ('rejected') then 'recusado'
    when v_mp in ('cancelled') then 'cancelado'
    else 'pendente' end;
  -- Um pedido aprovado só volta atrás por estorno
  if o.status = 'aprovado' and v_status not in ('aprovado', 'estornado') then
    v_status := 'aprovado';
  end if;
  if o.status = 'estornado' then
    v_status := 'estornado';
  end if;
  update audita.training_orders
     set status = v_status, mp_payment_id = coalesce(p_payment->>'id', mp_payment_id), mp_status = v_mp,
         mp_status_detail = p_payment->>'status_detail', mp_payment_method = p_payment->>'payment_method_id',
         paid_at = case when v_status = 'aprovado' then coalesce(paid_at, now()) else paid_at end, updated_at = now()
   where id = o.id;
  -- Estorno: a matrícula comprada fica suspensa
  if v_status = 'estornado' and o.enrollment_id is not null then
    update audita.training_enrollments set status = 'suspensa', status_note = 'Pagamento estornado no Mercado Pago.'
     where id = o.enrollment_id and status = 'ativa';
  end if;
  return jsonb_build_object('status', v_status, 'fulfill', v_status = 'aprovado' and o.enrollment_id is null,
                            'email', o.buyer_email, 'name', o.buyer_name);
end;
$$;

-- Libera o acesso: cria o aluno (conta já criada pela função) e a matrícula na versão publicada do pedido
create or replace function audita.training_order_fulfill(p_order_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o audita.training_orders;
  v_student uuid;
  v_enr uuid;
  v_new_student boolean := false;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into o from audita.training_orders where id = p_order_id for update;
  if not found or o.status <> 'aprovado' then
    raise exception 'Pedido não aprovado' using errcode = '23514';
  end if;
  if o.enrollment_id is not null then
    return jsonb_build_object('enrollment_id', o.enrollment_id, 'new_student', false);
  end if;
  select st.id into v_student from audita.training_students st where st.email = o.buyer_email;
  if v_student is null then
    insert into audita.training_students (user_id, full_name, email, cpf, phone, source)
    values (p_user_id, o.buyer_name, o.buyer_email, o.buyer_cpf, o.buyer_phone, 'compra')
    returning id into v_student;
    v_new_student := true;
  end if;
  select e.id into v_enr from audita.training_enrollments e
   where e.student_id = v_student and e.course_id = o.course_id and e.status in ('ativa', 'suspensa');
  if v_enr is null then
    perform set_config('audita.training_enroll', 'on', true);
    insert into audita.training_enrollments (student_id, course_id, version_id, access_until, source, notes)
    values (v_student, o.course_id, o.version_id, case when o.access_days is not null then v_today + o.access_days end, 'compra',
            'Compra pela vitrine (pedido ' || o.id || ').')
    returning id into v_enr;
    perform set_config('audita.training_enroll', 'off', true);
  end if;
  update audita.training_orders set student_id = v_student, enrollment_id = v_enr, updated_at = now() where id = o.id;
  return jsonb_build_object('enrollment_id', v_enr, 'new_student', v_new_student);
end;
$$;

-- Situação do pedido para a página de retorno (pelo token do pedido)
create or replace function audita.training_order_public(p_order_id uuid, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('status', o.status, 'code', o.course_code, 'title', o.course_title, 'amount', o.amount,
                            'email', o.buyer_email, 'enrolled', o.enrollment_id is not null, 'created_at', o.created_at)
    from audita.training_orders o where o.id = p_order_id and o.public_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- RLS e privilégios
-- ---------------------------------------------------------------------------
alter table audita.training_sales_settings enable row level security;
alter table audita.training_orders enable row level security;
create policy training_sales_settings_admin_select on audita.training_sales_settings for select to authenticated using ((select audita.is_admin()));
create policy training_sales_settings_admin_update on audita.training_sales_settings for update to authenticated
  using ((select audita.is_admin())) with check ((select audita.is_admin()));
create policy training_orders_admin_select on audita.training_orders for select to authenticated using ((select audita.is_admin()));

revoke all on audita.training_sales_settings, audita.training_orders from public, anon, authenticated;
grant select, update on audita.training_sales_settings to authenticated;
grant select on audita.training_orders to authenticated;

revoke all on function audita.training_sales_settings_before_write(), audita.training_set_payment_secret(text, text),
  audita.training_payment_secret(text), audita.training_store_open(), audita.training_catalog(text), audita.training_store_info(),
  audita.training_order_create(text, text, text, text, text, boolean), audita.training_order_set_preference(uuid, text),
  audita.training_order_apply_payment(uuid, jsonb), audita.training_order_fulfill(uuid, uuid), audita.training_order_public(uuid, text)
  from public, anon, authenticated;
grant execute on function audita.training_set_payment_secret(text, text) to authenticated;

grant all on all tables in schema audita to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
