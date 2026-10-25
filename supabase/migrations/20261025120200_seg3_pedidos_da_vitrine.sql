-- AUDITA — Correções da auditoria de segurança (25/10/2026), achados 3, 5, 6, 7 e 8 (pedidos da vitrine). Somente
-- acréscimos e substituição de funções; nenhum dado de cadastro é apagado.
--
--   5) training_order_fulfill pendurava o pedido de um estranho na matrícula que a pessoa do e-mail JÁ tinha, e o estorno
--      desse pedido suspendia a matrícula da vítima e cancelava o certificado dela. Agora a liberação só é dona da
--      matrícula que ela mesma cria (training_enrollments.order_id); se o e-mail já tem matrícula em aberto no curso,
--      nada é vinculado e o pedido fica marcado para REEMBOLSO MANUAL (manual_refund_reason, visível na tela de vendas).
--      O estorno só mexe na matrícula criada pelo próprio pedido.
--   3) O estorno de matrícula CONCLUÍDA passa a encerrar o acesso ao conteúdo (access_revoked_at, migração seg2), além de
--      cancelar o certificado.
--   6) Pedido pendente não vencia e era liberado mesmo depois de fechar as vendas, tirar o curso da vitrine, desativá-lo
--      ou mudar o preço. Agora o pedido vence (training_order_validity(), 3 dias; a preferência do Mercado Pago recebe o
--      mesmo vencimento) e, quando o pagamento é aprovado, vendas, curso, versão publicada, preço e vencimento são
--      conferidos de novo. Se algo não confere, o pedido fica aprovado (o dinheiro entrou), sem matrícula, marcado para
--      reembolso manual.
--   7/8) Compra anônima sem limite: limite por endereço IP (hash) e por e-mail numa janela de tempo, reaproveitamento do
--      pedido pendente do mesmo comprador (mesmo e-mail, curso, nome e CPF) em vez de criar outro, e e-mail com no máximo
--      254 caracteres. O aviso "Este e-mail já tem acesso" continua (decisão de experiência do comprador), mas conta nas
--      mesmas tentativas e é devolvido sem desfazer o registro da tentativa. O oráculo residual está em docs/TREINAMENTOS.md.

-- ---------------------------------------------------------------------------
-- Pedidos: vencimento, link de pagamento e marca de reembolso manual
-- ---------------------------------------------------------------------------
alter table audita.training_orders
  add column expires_at timestamptz,
  add column mp_init_point text check (mp_init_point is null or (mp_init_point ~ '^https://' and length(mp_init_point) <= 2000)),
  add column manual_refund_reason text check (manual_refund_reason is null or length(manual_refund_reason) between 5 and 300),
  add column manual_refund_at timestamptz,
  add constraint training_orders_manual_refund_consistent check ((manual_refund_reason is null) = (manual_refund_at is null));
comment on column audita.training_orders.expires_at is 'Vencimento do pedido (e da preferência do Mercado Pago). Nulo nos pedidos antigos: criação + validade.';
comment on column audita.training_orders.mp_init_point is 'Link de pagamento do Mercado Pago (reaproveitado quando o mesmo comprador tenta de novo).';
comment on column audita.training_orders.manual_refund_reason is 'Pagamento aprovado que NÃO liberou matrícula: o administrador devolve o valor no Mercado Pago.';

-- E-mail do comprador com o mesmo limite do cadastro do aluno (254). Produção: nenhum pedido acima disso.
alter table audita.training_orders add constraint training_orders_email_length check (length(buyer_email) <= 254) not valid;
alter table audita.training_orders validate constraint training_orders_email_length;
create index training_orders_pending_idx on audita.training_orders (buyer_email, course_id, created_at desc) where status = 'pendente';

-- Validade do pedido pendente (constante única: banco, preferência do Mercado Pago e página do pedido)
create or replace function audita.training_order_validity()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '3 days';
$$;

-- ---------------------------------------------------------------------------
-- Tentativas de compra (limite por IP e por e-mail). Guarda só hashes: o IP chega já resumido (HMAC) pela função
-- "vitrine" e o e-mail é resumido aqui (SHA-256). São contadores efêmeros, não cadastros: linhas com mais de 2 dias são
-- descartadas na própria compra.
-- ---------------------------------------------------------------------------
create table audita.training_purchase_attempts (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ip_hash     text check (ip_hash is null or ip_hash ~ '^[0-9a-f]{64}$'),
  email_hash  text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  course_id   uuid
);
comment on table audita.training_purchase_attempts is 'Tentativas de compra na vitrine (hash do IP e do e-mail) para limitar abuso; descartadas após 2 dias.';
create index training_purchase_attempts_ip_idx on audita.training_purchase_attempts (ip_hash, created_at) where ip_hash is not null;
create index training_purchase_attempts_email_idx on audita.training_purchase_attempts (email_hash, created_at);
create index training_purchase_attempts_created_idx on audita.training_purchase_attempts (created_at);
alter table audita.training_purchase_attempts enable row level security;
create policy training_purchase_attempts_admin_select on audita.training_purchase_attempts for select to authenticated
  using ((select audita.is_admin()));
revoke all on audita.training_purchase_attempts from public, anon, authenticated;
grant select on audita.training_purchase_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- Novo pedido (função "vitrine"): validações, limites, aviso de acesso existente e reaproveitamento do pendente
-- ---------------------------------------------------------------------------
create or replace function audita.training_order_create(
  p_code text, p_name text, p_email text, p_cpf text, p_phone text, p_accept boolean, p_marketing boolean, p_ip_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Limites da compra anônima (janela deslizante). Ajuste aqui, numa nova migração, se o volume real pedir.
  c_window        constant interval := interval '1 hour';
  c_max_per_ip    constant integer := 20;
  c_max_per_email constant integer := 5;
  s audita.training_sales_settings;
  c audita.training_courses;
  v audita.training_versions;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_cpf text := nullif(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), '');
  v_phone text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
  v_ip text := lower(nullif(btrim(coalesce(p_ip_hash, '')), ''));
  v_email_hash text;
  v_reused boolean := false;
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
  if length(v_name) < 5 or length(v_name) > 160 or v_name !~ '\s' then
    raise exception 'Informe seu nome completo' using errcode = '23514';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then
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
  if v_ip is not null and v_ip !~ '^[0-9a-f]{64}$' then
    raise exception 'Requisição inválida' using errcode = '22023';
  end if;

  -- Limite de tentativas (inclui as que terminam no aviso "já tem acesso")
  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');
  if (v_ip is not null and (select count(*) from audita.training_purchase_attempts a
                             where a.ip_hash = v_ip and a.created_at > now() - c_window) >= c_max_per_ip)
     or (select count(*) from audita.training_purchase_attempts a
          where a.email_hash = v_email_hash and a.created_at > now() - c_window) >= c_max_per_email then
    raise exception 'Muitas tentativas de compra em pouco tempo. Aguarde alguns minutos e tente de novo.' using errcode = '54000';
  end if;
  delete from audita.training_purchase_attempts where created_at < now() - interval '2 days';
  insert into audita.training_purchase_attempts (ip_hash, email_hash, course_id) values (v_ip, v_email_hash, c.id);

  -- Aviso de acesso existente: devolvido como resposta (sem exceção) para a tentativa continuar contada
  if exists (select 1 from audita.training_enrollments e join audita.training_students st on st.id = e.student_id
              where st.email = v_email and e.course_id = c.id and e.status in ('ativa', 'suspensa')) then
    return jsonb_build_object('erro', 'Este e-mail já tem acesso a este curso. Entre na área do aluno.', 'codigo', 'ja_tem_acesso');
  end if;

  -- Mesmo comprador tentando de novo: reaproveita o pedido pendente ainda válido (mesmo preço e versão)
  select * into o from audita.training_orders po
   where po.buyer_email = v_email and po.course_id = c.id and po.status = 'pendente' and po.manual_refund_reason is null
     and po.amount = c.price and po.version_id = v.id
     and po.buyer_name = v_name and po.buyer_cpf is not distinct from v_cpf
     and coalesce(po.expires_at, po.created_at + audita.training_order_validity()) > now() + interval '30 minutes'
   order by po.created_at desc
   limit 1;
  if found then
    v_reused := true;
  else
    insert into audita.training_orders (course_id, version_id, course_code, course_title, buyer_name, buyer_email, buyer_cpf, buyer_phone,
                                        amount, access_days, terms_accepted_at, terms_version, marketing_opt_in, expires_at)
    values (c.id, v.id, c.course_code, v.title, v_name, v_email, v_cpf, v_phone, c.price, c.access_days, now(), s.terms_updated_at,
            coalesce(p_marketing, false), now() + audita.training_order_validity())
    returning * into o;
  end if;
  return jsonb_build_object('order_id', o.id, 'token', o.public_token, 'amount', o.amount, 'code', o.course_code,
                            'title', o.course_title, 'email', o.buyer_email, 'name', o.buyer_name, 'cpf', o.buyer_cpf,
                            'created_at', o.created_at,
                            'expires_at', coalesce(o.expires_at, o.created_at + audita.training_order_validity()),
                            'init_point', o.mp_init_point, 'reused', v_reused);
end;
$$;

-- Assinaturas anteriores (sem o hash do IP): continuam com o contrato antigo (exceção no "já tem acesso") e passam
-- pelas mesmas regras e limites
create or replace function audita.training_order_create(
  p_code text, p_name text, p_email text, p_cpf text, p_phone text, p_accept boolean, p_marketing boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb := audita.training_order_create(p_code, p_name, p_email, p_cpf, p_phone, p_accept, p_marketing, null::text);
begin
  if r ? 'erro' then
    raise exception '%', r ->> 'erro' using errcode = '23505';
  end if;
  return r;
end;
$$;

create or replace function audita.training_order_create(
  p_code text, p_name text, p_email text, p_cpf text, p_phone text, p_accept boolean
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select audita.training_order_create(p_code, p_name, p_email, p_cpf, p_phone, p_accept, false);
$$;

-- Preferência criada no Mercado Pago: guarda também o link (para o reaproveitamento)
create or replace function audita.training_order_set_preference(p_order_id uuid, p_preference text, p_init_point text)
returns void
language sql
security definer
set search_path = ''
as $$
  update audita.training_orders
     set mp_preference_id = p_preference,
         mp_init_point = case when p_init_point ~ '^https://' and length(p_init_point) <= 2000 then p_init_point end,
         updated_at = now()
   where id = p_order_id and status = 'pendente';
$$;

-- ---------------------------------------------------------------------------
-- Conferência na liberação: o que impede a matrícula automática (null = pode liberar).
-- p_paid_ref (data do pagamento) liga também a conferência comercial: vencimento, vendas abertas, vitrine e preço.
-- ---------------------------------------------------------------------------
create or replace function audita.training_order_blocker(o audita.training_orders, p_paid_ref timestamptz)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c audita.training_courses;
  st audita.training_students;
begin
  select * into c from audita.training_courses where id = o.course_id;
  if c.status is distinct from 'ativo' then
    return 'O treinamento estava inativo quando o pagamento foi confirmado.';
  end if;
  if not exists (select 1 from audita.training_versions v where v.course_id = o.course_id and v.status = 'publicada') then
    return 'O treinamento estava sem versão publicada quando o pagamento foi confirmado.';
  end if;
  if p_paid_ref is not null then
    if p_paid_ref > coalesce(o.expires_at, o.created_at + audita.training_order_validity()) then
      return 'Pagamento feito depois do vencimento do pedido.';
    end if;
    if not coalesce((select s.sales_enabled from audita.training_sales_settings s where s.id = 1), false) then
      return 'As vendas estavam fechadas quando o pagamento foi confirmado.';
    end if;
    if not c.on_sale or c.price is null then
      return 'O treinamento estava fora da vitrine quando o pagamento foi confirmado.';
    end if;
    if o.amount < c.price then
      return 'O preço do treinamento mudou depois do pedido (valor pago menor que o preço atual).';
    end if;
  end if;
  select * into st from audita.training_students where email = o.buyer_email;
  if found then
    if st.status <> 'ativo' then
      return 'O cadastro de aluno deste e-mail está inativo.';
    end if;
    if exists (select 1 from audita.training_enrollments e
                where e.student_id = st.id and e.course_id = o.course_id and e.status in ('ativa', 'suspensa')) then
      return 'O e-mail já tinha matrícula em aberto neste treinamento; o pedido não foi vinculado a ela.';
    end if;
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resultado do pagamento (função "mercadopago")
-- ---------------------------------------------------------------------------
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
  v_paid_ref timestamptz;
  v_block text;
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

  -- Aprovação: confere de novo vencimento, vendas, curso, versão, preço e matrícula já existente. Se algo não confere,
  -- o pedido fica aprovado, sem matrícula, marcado para reembolso manual.
  if v_status = 'aprovado' and o.status <> 'aprovado' and o.enrollment_id is null and o.manual_refund_reason is null then
    begin
      v_paid_ref := (p_payment->>'date_created')::timestamptz;
    exception when others then
      v_paid_ref := null;
    end;
    v_block := audita.training_order_blocker(o, coalesce(v_paid_ref, now()));
    if v_block is not null then
      update audita.training_orders set manual_refund_reason = v_block, manual_refund_at = now() where id = o.id;
      o.manual_refund_reason := v_block;
    end if;
  end if;

  -- Estorno (inclusive o reembolso do arrependimento, feito no Mercado Pago), só na matrícula criada por ESTE pedido:
  -- ativa ⇒ suspensa; concluída ⇒ acesso ao conteúdo encerrado; certificado cancelado (Termos, itens 5.4 e 7.4)
  if v_status = 'estornado' and o.enrollment_id is not null
     and exists (select 1 from audita.training_enrollments e where e.id = o.enrollment_id and e.order_id = o.id) then
    perform set_config('audita.training_flow', 'on', true);
    update audita.training_enrollments set status = 'suspensa', status_note = 'Pagamento estornado no Mercado Pago.'
     where id = o.enrollment_id and order_id = o.id and status = 'ativa';
    update audita.training_enrollments
       set access_revoked_at = now(), status_note = 'Pagamento estornado no Mercado Pago: acesso ao conteúdo encerrado.'
     where id = o.enrollment_id and order_id = o.id and status = 'concluida' and access_revoked_at is null;
    update audita.training_certificates set status = 'cancelado', status_note = 'Compra reembolsada ou estornada no Mercado Pago.'
     where enrollment_id = o.enrollment_id and status = 'valido';
    perform set_config('audita.training_flow', 'off', true);
  end if;
  return jsonb_build_object('status', v_status,
                            'fulfill', v_status = 'aprovado' and o.enrollment_id is null and o.manual_refund_reason is null,
                            'manual_refund', v_status = 'aprovado' and o.manual_refund_reason is not null,
                            'email', o.buyer_email, 'name', o.buyer_name);
end;
$$;

-- ---------------------------------------------------------------------------
-- Libera o acesso: só cria (e só é dona de) uma matrícula NOVA, na versão publicada agora
-- ---------------------------------------------------------------------------
create or replace function audita.training_order_fulfill(p_order_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o audita.training_orders;
  v_student uuid;
  v_version uuid;
  v_enr uuid;
  v_block text;
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
  if o.manual_refund_reason is null then
    v_block := audita.training_order_blocker(o, null);
    if v_block is not null then
      update audita.training_orders set manual_refund_reason = v_block, manual_refund_at = now(), updated_at = now() where id = o.id;
      o.manual_refund_reason := v_block;
    end if;
  end if;
  if o.manual_refund_reason is not null then
    return jsonb_build_object('enrollment_id', null, 'new_student', false, 'manual_refund', true);
  end if;
  select v.id into v_version from audita.training_versions v where v.course_id = o.course_id and v.status = 'publicada';
  select st.id into v_student from audita.training_students st where st.email = o.buyer_email;
  if v_student is null then
    insert into audita.training_students (user_id, full_name, email, cpf, phone, source)
    values (p_user_id, o.buyer_name, o.buyer_email, o.buyer_cpf, o.buyer_phone, 'compra')
    returning id into v_student;
    v_new_student := true;
  end if;
  perform set_config('audita.training_enroll', 'on', true);
  insert into audita.training_enrollments (student_id, course_id, version_id, access_until, source, notes, order_id)
  values (v_student, o.course_id, v_version, case when o.access_days is not null then v_today + o.access_days end, 'compra',
          'Compra pela vitrine (pedido ' || o.id || ').', o.id)
  returning id into v_enr;
  perform set_config('audita.training_enroll', 'off', true);
  update audita.training_orders set student_id = v_student, enrollment_id = v_enr, updated_at = now() where id = o.id;
  return jsonb_build_object('enrollment_id', v_enr, 'new_student', v_new_student);
end;
$$;

-- Situação do pedido para a página de retorno (pelo token do pedido): + vencido e reembolso manual
create or replace function audita.training_order_public(p_order_id uuid, p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('status', o.status, 'code', o.course_code, 'title', o.course_title, 'amount', o.amount,
                            'email', o.buyer_email, 'enrolled', o.enrollment_id is not null, 'created_at', o.created_at,
                            'expired', o.status = 'pendente' and coalesce(o.expires_at, o.created_at + audita.training_order_validity()) < now(),
                            'manual_refund', o.manual_refund_reason is not null)
    from audita.training_orders o where o.id = p_order_id and o.public_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Pedidos já liberados: a matrícula criada pela compra passa a apontar para o pedido que a criou (mesma nota gravada
-- pela liberação). Pedidos pendurados em matrícula de outra origem ficam sem vínculo e o estorno não mexe nelas.
-- ---------------------------------------------------------------------------
do $$
begin
  perform set_config('audita.training_flow', 'on', true);
  update audita.training_enrollments e
     set order_id = o.id
    from audita.training_orders o
   where o.enrollment_id = e.id and e.order_id is null and e.source = 'compra'
     and e.notes = 'Compra pela vitrine (pedido ' || o.id || ').';
  perform set_config('audita.training_flow', 'off', true);
end;
$$;

revoke all on function audita.training_order_validity(), audita.training_order_blocker(audita.training_orders, timestamptz),
  audita.training_order_create(text, text, text, text, text, boolean, boolean, text),
  audita.training_order_create(text, text, text, text, text, boolean, boolean),
  audita.training_order_create(text, text, text, text, text, boolean),
  audita.training_order_set_preference(uuid, text, text)
  from public, anon, authenticated;
grant all on audita.training_purchase_attempts to service_role;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
