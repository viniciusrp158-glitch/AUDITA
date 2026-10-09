-- Expõe o schema `audita` na API (PostgREST). A proteção vem de GRANTs explícitos + RLS.
-- ATENÇÃO (produção/projeto compartilhado): ACRESCENTAR `audita` à lista existente, nunca substituir
-- os schemas usados por outros sistemas. Conferir também Settings → Data API → Exposed schemas.
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, audita';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
