-- AUDITA — C1 Artes com IA na Comunicação (pedido do Diretor em 27/10/2026, que decide a D-08 do AUDDOC017 §18):
-- provedor Claude (Anthropic), chamado só pelo servidor com a chave em variável de ambiente (nunca no navegador ou no
-- Git); vai para a IA apenas o pedido escrito por quem cria a peça, as imagens que ela anexar, a marca, o formato e o
-- serviço escolhido (sem dados de clientes); toda arte continua passando pela revisão humana do I10 (checklist de marca e texto) antes de exportar.
-- Somente acréscimos.
--
-- comm_ai_requests: cada pedido à IA (criar ou ajustar a arte de uma peça), com situação, modelo e consumo.
-- comm_piece_arts:  arte gerada (SVG), imutável. A peça aponta para a arte atual (comm_pieces.art_id); a versão enviada
--                   para revisão congela o art_id no snapshot, e a arte nunca muda, então a versão aprovada é reproduzível.
-- comm_ai_references: imagens enviadas com o pedido (até 3): referência de estilo para a IA ou foto de fundo da arte.
--                   Imutáveis. A arte que usa uma foto de fundo aponta para ela (background_ref_id).
-- O logo oficial e o rodapé (assinatura, slogan e contatos) não são desenhados pela IA: o sistema os aplica por cima.

create table audita.comm_ai_requests (
  id           uuid primary key default gen_random_uuid(),
  piece_id     uuid not null references audita.comm_pieces (id) on delete restrict,
  mode         text not null check (mode in ('criar', 'ajustar')),
  instruction  text not null check (length(btrim(instruction)) between 3 and 2000),
  status       text not null default 'gerando' check (status in ('gerando', 'concluida', 'erro')),
  model        text check (model is null or length(model) <= 80),
  usage        jsonb,
  error        text check (error is null or length(error) <= 500),
  created_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  finished_at  timestamptz,
  is_test      boolean not null default false,
  constraint comm_ai_requests_finished check ((status = 'gerando') = (finished_at is null))
);
comment on table audita.comm_ai_requests is 'Pedidos de arte à IA (D-08 decidida em 27/10/2026): pedido, situação, modelo e consumo. Somente inclusão e conclusão.';
create index comm_ai_requests_piece_idx on audita.comm_ai_requests (piece_id, created_at desc);
create unique index comm_ai_requests_one_running on audita.comm_ai_requests (piece_id) where status = 'gerando';

create table audita.comm_ai_references (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references audita.comm_ai_requests (id) on delete restrict,
  piece_id           uuid not null references audita.comm_pieces (id) on delete restrict,
  position           smallint not null check (position between 1 and 3),
  mime_type          text not null check (mime_type in ('image/png', 'image/jpeg')),
  data_base64        text not null check (length(data_base64) between 100 and 4000000 and data_base64 ~ '^[A-Za-z0-9+/=]+$'),
  width              integer not null check (width between 1 and 4000),
  height             integer not null check (height between 1 and 4000),
  use_as_background  boolean not null default false,
  created_at         timestamptz not null default now(),
  created_by         uuid default auth.uid(),
  is_test            boolean not null default false,
  unique (request_id, position)
);
comment on table audita.comm_ai_references is 'Imagens enviadas com o pedido à IA: referência de estilo ou foto de fundo da arte (já reduzidas pelo servidor). Imutáveis.';
create unique index comm_ai_references_one_background on audita.comm_ai_references (request_id) where use_as_background;
create index comm_ai_references_piece_idx on audita.comm_ai_references (piece_id);

create table audita.comm_piece_arts (
  id          uuid primary key default gen_random_uuid(),
  piece_id    uuid not null references audita.comm_pieces (id) on delete restrict,
  request_id  uuid not null unique references audita.comm_ai_requests (id) on delete restrict,
  svg         text not null check (length(svg) between 50 and 400000 and svg ~ '^\s*<svg'),
  alt_text    text check (alt_text is null or length(alt_text) <= 500),
  background_ref_id uuid references audita.comm_ai_references (id) on delete restrict,
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  is_test     boolean not null default false
);
comment on table audita.comm_piece_arts is 'Artes das peças geradas pela IA (SVG renderizado só no servidor). Imutáveis: ajuste gera nova arte.';
create index comm_piece_arts_piece_idx on audita.comm_piece_arts (piece_id, created_at desc);

alter table audita.comm_pieces add column art_id uuid references audita.comm_piece_arts (id) on delete restrict;
comment on column audita.comm_pieces.art_id is 'Arte atual gerada pela IA (null = layout padrão do I10, só com os textos).';

-- ---------------------------------------------------------------------------
-- Regras
-- ---------------------------------------------------------------------------
create or replace function audita.comm_ai_requests_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform 1 from audita.comm_pieces p where p.id = new.piece_id and p.status = 'rascunho';
    if not found then
      raise exception 'A arte só pode ser criada ou ajustada com a peça em rascunho' using errcode = '22023';
    end if;
    new.status := 'gerando';
    new.finished_at := null;
    new.usage := null;
    new.error := null;
    new.created_at := now();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Pedidos à IA não podem ser excluídos' using errcode = '42501';
  end if;
  -- Única mudança aceita: concluir (ou registrar erro) um pedido em andamento
  if old.status <> 'gerando' or new.status = 'gerando'
     or new.id is distinct from old.id or new.piece_id is distinct from old.piece_id or new.mode is distinct from old.mode
     or new.instruction is distinct from old.instruction or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by or new.is_test is distinct from old.is_test then
    raise exception 'Pedido à IA já concluído não pode ser alterado' using errcode = '42501';
  end if;
  new.finished_at := now();
  return new;
end;
$$;
create trigger comm_ai_requests_guard before insert or update or delete on audita.comm_ai_requests
  for each row execute function audita.comm_ai_requests_guard();
create trigger comm_ai_requests_audit after insert or update on audita.comm_ai_requests
  for each row execute function audita.log_row_change('id', 'piece_id');

create or replace function audita.comm_ai_references_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r audita.comm_ai_requests;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Imagens de referência são imutáveis' using errcode = '42501';
  end if;
  select * into r from audita.comm_ai_requests where id = new.request_id;
  if r.id is null or r.piece_id <> new.piece_id or r.status <> 'gerando' then
    raise exception 'A imagem precisa de um pedido em andamento da mesma peça' using errcode = '23514';
  end if;
  new.created_at := now();
  new.created_by := (select auth.uid());
  new.is_test := r.is_test;
  return new;
end;
$$;
create trigger comm_ai_references_guard before insert or update or delete on audita.comm_ai_references
  for each row execute function audita.comm_ai_references_guard();

create or replace function audita.comm_piece_arts_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r audita.comm_ai_requests;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Artes geradas são imutáveis' using errcode = '42501';
  end if;
  select * into r from audita.comm_ai_requests where id = new.request_id;
  if r.id is null or r.piece_id <> new.piece_id or r.status <> 'gerando' then
    raise exception 'A arte precisa de um pedido em andamento da mesma peça' using errcode = '23514';
  end if;
  if new.background_ref_id is not null then
    perform 1 from audita.comm_ai_references f where f.id = new.background_ref_id and f.piece_id = new.piece_id and f.use_as_background;
    if not found then
      raise exception 'A foto de fundo precisa ser uma imagem enviada para esta peça' using errcode = '23514';
    end if;
  end if;
  -- Conteúdo ativo nunca é aceito (o SVG só é renderizado no servidor, mas a regra fica também no banco)
  if new.svg ~* '<script|<foreignobject|\son[a-z]+\s*=|javascript:|<iframe|<object|<embed' then
    raise exception 'A arte contém elementos não permitidos' using errcode = '23514';
  end if;
  new.created_at := now();
  new.created_by := (select auth.uid());
  new.is_test := r.is_test;
  return new;
end;
$$;
create trigger comm_piece_arts_guard before insert or update or delete on audita.comm_piece_arts
  for each row execute function audita.comm_piece_arts_guard();

-- A peça só aponta para uma arte dela mesma
create or replace function audita.comm_pieces_art_check()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.art_id is not null and new.art_id is distinct from (case when tg_op = 'UPDATE' then old.art_id end) then
    perform 1 from audita.comm_piece_arts a where a.id = new.art_id and a.piece_id = new.id;
    if not found then
      raise exception 'A arte informada não pertence a esta peça' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
create trigger comm_pieces_art_check before insert or update of art_id on audita.comm_pieces
  for each row execute function audita.comm_pieces_art_check();

-- ---------------------------------------------------------------------------
-- RLS e permissões: mesmas pessoas da Comunicação (administrador e marketing)
-- ---------------------------------------------------------------------------
alter table audita.comm_ai_requests enable row level security;
alter table audita.comm_piece_arts enable row level security;
alter table audita.comm_ai_references enable row level security;

create policy comm_ai_requests_select on audita.comm_ai_requests for select to authenticated using ((select audita.can_communicate()));
create policy comm_ai_requests_insert on audita.comm_ai_requests for insert to authenticated with check ((select audita.can_communicate()));
create policy comm_ai_requests_update on audita.comm_ai_requests for update to authenticated
  using ((select audita.can_communicate()) and status = 'gerando') with check ((select audita.can_communicate()));
create policy comm_ai_references_select on audita.comm_ai_references for select to authenticated using ((select audita.can_communicate()));
create policy comm_ai_references_insert on audita.comm_ai_references for insert to authenticated with check ((select audita.can_communicate()));
create policy comm_piece_arts_select on audita.comm_piece_arts for select to authenticated using ((select audita.can_communicate()));
create policy comm_piece_arts_insert on audita.comm_piece_arts for insert to authenticated with check ((select audita.can_communicate()));

revoke all on audita.comm_ai_requests, audita.comm_piece_arts, audita.comm_ai_references from public, anon, authenticated;
grant select, insert, update (status, model, usage, error) on audita.comm_ai_requests to authenticated;
grant select, insert on audita.comm_piece_arts, audita.comm_ai_references to authenticated;
grant all on audita.comm_ai_requests, audita.comm_piece_arts, audita.comm_ai_references to service_role;

revoke all on function audita.comm_ai_requests_guard(), audita.comm_ai_references_guard(), audita.comm_piece_arts_guard(), audita.comm_pieces_art_check() from public, anon, authenticated;

notify pgrst, 'reload schema';
