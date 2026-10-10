-- AUDITA — I6 correção: reopen_quote usava a variável "reason", ambígua com a coluna quote_revisions.reason (erro 42702).
-- Substitui somente a função (mesma assinatura e mesmas regras); nenhuma estrutura ou dado é alterado.
create or replace function audita.reopen_quote(p_quote_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q audita.quotes;
  r audita.quote_revisions;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if not audita.is_admin() then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;
  select * into q from audita.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Cotação não encontrada' using errcode = 'P0002';
  end if;
  if q.status not in ('revisada', 'emitida', 'recusada', 'aceita') then
    raise exception 'Esta cotação não pode ser reaberta' using errcode = '22023';
  end if;
  if v_reason is null or length(v_reason) < 5 then
    raise exception 'Informe o motivo da reabertura' using errcode = '23514';
  end if;
  select * into r from audita.quote_revisions where id = q.current_revision_id for update;
  perform set_config('audita.quote_flow', 'on', true);
  update audita.quote_revisions qr
     set status = case when qr.status in ('revisada', 'emitida') then 'substituida' else qr.status end,
         superseded_at = now(),
         decision_note = case when qr.status in ('revisada', 'emitida') then v_reason else qr.decision_note end,
         decided_at = case when qr.status in ('revisada', 'emitida') then now() else qr.decided_at end,
         decided_by = case when qr.status in ('revisada', 'emitida') then (select auth.uid()) else qr.decided_by end
   where qr.id = r.id;
  update audita.quotes set status = 'rascunho' where id = q.id;
  perform set_config('audita.quote_flow', 'off', true);
end;
$$;

revoke all on function audita.reopen_quote(uuid, text) from public, anon, authenticated;
grant execute on function audita.reopen_quote(uuid, text) to authenticated;
grant all on function audita.reopen_quote(uuid, text) to service_role;
