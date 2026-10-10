-- I9.1 — Achado da autoverificação (teste seguranca-i9): a função de gatilho app_users_guard, criada no I9.1, ficou
-- executável por PUBLIC (padrão do Postgres). Funções de gatilho não precisam de EXECUTE para disparar; revoga-se.
-- Somente aditiva.
revoke all on function audita.app_users_guard() from public, anon, authenticated;
