# Levar o Sistema AUDITA para outra VPS

Tudo o que é **código e configuração** está neste repositório (ramo `develop`). O que **não pode** ir para o Git — dados do
banco, arquivos do Storage e segredos — fica no backup copiado para o computador do Diretor por
[`scripts/baixar-backup-vps.sh`](../../scripts/baixar-backup-vps.sh), na pasta `Documents\AUDITA-BACKUP-VPS\<data>\`.

| O quê | Onde está |
|---|---|
| Código do site, migrações, função `usuarios` | repositório (`src/`, `supabase/migrations/`, `supabase/functions/`) |
| Compose do site, Dockerfile, Nginx, scripts de backup e e-mail, modelo de e-mail | repositório (`deploy/vps/`) |
| Nginx em uso, já com o HTTPS do certbot | repositório ([`nginx-audita-sistema.certbot.conf`](nginx-audita-sistema.certbot.conf)) |
| Banco completo (dados do esquema `audita` e usuários do Auth, com as senhas) | backup: `db_<data>.sql.gz` |
| Arquivos do Storage (Biblioteca, logos, anexos) | backup: `storage_<data>.tar.gz` |
| Segredos do Supabase (`JWT_SECRET`, chaves, senha do Postgres, SMTP do Brevo) | backup: `env_<data>` |
| Variáveis do site (URL da API e chave publicável) | backup: `web-env_<data>` |
| Demais arquivos do servidor (Kong, funções, cron, `/usr/local/bin/audita-*`) | backup: `config_<data>.tar.gz` |

O `.env` do Supabase precisa ser **o mesmo** na VPS nova: o `JWT_SECRET` e as chaves assinam as sessões e a chave
publicável gravada no site. Com outro `.env`, o site e os usuários deixam de funcionar.

## Passo a passo (VPS nova, Ubuntu 24.04, com Docker e Nginx)

1. **Antes de começar:** rodar `sh scripts/baixar-backup-vps.sh agora`, se a VPS antiga ainda responder, e conferir que o
   SHA-256 bateu. Se ela não responder, usar o backup mais recente já copiado.
2. **Supabase:** baixar o Supabase self-hosted na mesma versão (`self-hosted/v0.8.2`) para `/opt/supabase-audita`; extrair o
   `config_<data>.tar.gz` na raiz (`tar -xzf config_<data>.tar.gz -C /`), o que repõe `.env`, `docker-compose.vps.yml`,
   `volumes/api`, `volumes/functions` e demais arquivos; subir com `docker compose up -d` e esperar todos *healthy*.
3. **Banco:** `docker compose up -d` (todos os serviços: o Auth precisa criar a estrutura dele antes) e depois
   `gunzip -c db_<data>.sql.gz | docker exec -i audita-db psql -U supabase_admin -d postgres`. Erros de "already exists" são
   esperados. **Conferir em seguida** (lição de 21/10/2026): as contagens de todas as tabelas contra o `COPY` do backup;
   se `auth.users` ficar vazio, recarregar só os blocos `COPY auth.*` (menos `schema_migrations`) com
   `session_replication_role = replica`; completar `auth.schema_migrations` com as versões do backup (senão o Auth tenta
   refazer atualizações e fica reiniciando); e reaplicar, do próprio backup, as restrições que faltarem (`ADD CONSTRAINT`),
   em especial `audita.app_users_user_id_fkey` e as chaves de `auth.identities`/`sessions`/`one_time_tokens`.
4. **Storage:** parar o serviço `storage`, extrair `storage_<data>.tar.gz` em `/opt/supabase-audita/volumes/` e subir de novo.
5. **Site:** `/opt/audita-sistema` já vem do pacote de configuração (`docker-compose.yml`, `web.env`, `.env`); publicar a
   versão atual do `develop` como em [README.md](README.md#publicar-uma-nova-versão-do-site).
6. **Nginx e HTTPS:** copiar [`nginx-audita-sistema.conf`](nginx-audita-sistema.conf) para
   `/etc/nginx/sites-available/audita-sistema`, ligar em `sites-enabled` (tirar o `default`), copiar
   [`nginx-conf.d/`](nginx-conf.d) para `/etc/nginx/conf.d/` (IP real do Cloudflare e o `map` do WebSocket, que antes vinha do
   arquivo do PRO) e `nginx -t && systemctl reload nginx`. No Cloudflare, apontar os 3 registros A (`@`, `www`, `api`)
   para o IP novo. Certificado pela **validação DNS do Cloudflare** (não depende de o IP responder): instalar
   `python3-certbot-dns-cloudflare`, gravar o token em `/root/.secrets/cloudflare.ini` (600) e rodar
   `certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini --cert-name audita.seg.br -d audita.seg.br -d www.audita.seg.br -d api.audita.seg.br`
   e `certbot install --nginx --cert-name audita.seg.br --redirect`. O token precisa de **Zone:Read e DNS:Edit** só da zona
   `audita.seg.br` e **sem validade**, senão a renovação automática falha.
7. **Backup e e-mail:** o pacote de configuração já repõe `/usr/local/bin/audita-*` e `/etc/cron.d/audita-sistema-backup`;
   conferir com `audita-email status`.
8. **Conferência:** 11 serviços *healthy*; `https://api.audita.seg.br/auth/v1/health` 200; login do Diretor; Biblioteca
   abrindo os PDFs; "Esqueci minha senha" entregue; contagens das tabelas iguais às do backup.

Se a VPS nova também hospedar o Audita PRO, valem as mesmas regras do [README.md](README.md): nada do PRO é alterado.
