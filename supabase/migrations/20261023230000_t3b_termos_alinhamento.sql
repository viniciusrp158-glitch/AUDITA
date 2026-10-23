-- AUDITA — T3b Treinamentos: alinhamento com os Termos de uso e de compra e a Política de privacidade revisados
-- (23/10/2026). Somente acréscimos.
--   * consentimento opcional para novidades e ofertas, registrado no pedido (Política de privacidade, item 3: base legal
--     "consentimento");
--   * estorno ou reembolso no Mercado Pago cancela também o certificado (Termos, itens 5.4 e 7.4).

alter table audita.training_orders add column marketing_opt_in boolean not null default false;
comment on column audita.training_orders.marketing_opt_in is 'Aceitou receber novidades e ofertas (caixa opcional e separada na compra).';

create or replace function audita.training_order_create(
  p_code text, p_name text, p_email text, p_cpf text, p_phone text, p_accept boolean, p_marketing boolean
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
                                      amount, access_days, terms_accepted_at, terms_version, marketing_opt_in)
  values (c.id, v.id, c.course_code, v.title, btrim(p_name), v_email, v_cpf, v_phone, c.price, c.access_days, now(), s.terms_updated_at,
          coalesce(p_marketing, false))
  returning * into o;
  return jsonb_build_object('order_id', o.id, 'token', o.public_token, 'amount', o.amount, 'code', o.course_code,
                            'title', o.course_title, 'email', o.buyer_email, 'name', o.buyer_name, 'cpf', o.buyer_cpf);
end;
$$;

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
  -- Estorno (inclusive o reembolso do arrependimento, feito no Mercado Pago): a matrícula comprada fica suspensa e o
  -- certificado, se já emitido, é cancelado (Termos de uso e de compra, itens 5.4 e 7.4)
  if v_status = 'estornado' and o.enrollment_id is not null then
    update audita.training_enrollments set status = 'suspensa', status_note = 'Pagamento estornado no Mercado Pago.'
     where id = o.enrollment_id and status = 'ativa';
    update audita.training_certificates set status = 'cancelado', status_note = 'Compra reembolsada ou estornada no Mercado Pago.'
     where enrollment_id = o.enrollment_id and status = 'valido';
  end if;
  return jsonb_build_object('status', v_status, 'fulfill', v_status = 'aprovado' and o.enrollment_id is null,
                            'email', o.buyer_email, 'name', o.buyer_name);
end;
$$;

revoke all on function audita.training_order_create(text, text, text, text, text, boolean, boolean) from public, anon, authenticated;
grant all on all functions in schema audita to service_role;

notify pgrst, 'reload schema';
