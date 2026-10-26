# Sistema AUDITA de Operação na VPS

> **OBSOLETO desde 26/10/2026.** Descreve a instalação antiga em `/opt` (Nginx do servidor e certificado próprio), removida
> da VPS em 26/10/2026, com cópia de segurança no computador do Diretor. A instalação em uso está em
> [`deploy/servidor/README.md`](../servidor/README.md) (`/home/deploy/audita`, Nginx em container `audita-borda`).

VPS `vmi3662674` — `164.68.112.61`, Ubuntu 24.04, acesso `root` por chave SSH. **A mesma VPS roda o Audita PRO**: nunca
alterar `/opt/supabase`, `/opt/auditapro-*`, `/etc/nginx/sites-available/auditapro`, nem usar `systemctl restart nginx`
ou `docker compose down` na pasta do PRO. Nginx: sempre `nginx -t && systemctl reload nginx`.

| Endereço | O que serve |
|---|---|
| `https://audita.seg.br/empresa` | Sistema (Next.js com servidor, container `audita-web` em `127.0.0.1:3200`); a raiz leva a `/empresa` |
| `https://www.audita.seg.br` | O mesmo sistema |
| `https://api.audita.seg.br` | Supabase do AUDITA: somente `/auth`, `/rest`, `/storage`, `/functions`, `/realtime`, `/graphql` (`/v1`) |

**Cloudflare:** os 3 registros A (`@`, `www`, `api`) estão com **proxy ligado** e SSL/TLS em **Full (strict)** desde
15/10/2026 (a rede do provedor da VPS perde pacotes; o proxy reduz o efeito). Não usar o modo "Flexible" (o site entra em
repetição). Os registros de e-mail do Brevo (TXT, CNAME `brevo1`/`brevo2`, `_dmarc`) ficam sempre em "DNS only". O IP
real dos visitantes vem do `/etc/nginx/conf.d/cloudflare-realip.conf`. **VPS reinstalada em 20–21/10/2026** (conflito de IP na
Contabo): o Audita PRO e o HUB não estão mais nesta VPS até serem reinstalados pela sessão deles.

## Peças no servidor

- **Supabase** `self-hosted/v0.8.2` em `/opt/supabase-audita` (projeto Compose `supabase-audita`, containers `audita-*`).
  Segredos só em `/opt/supabase-audita/.env` (600). `COMPOSE_FILE` inclui [`docker-compose.vps.yml`](docker-compose.vps.yml):
  portas 8100/5442/6553 só em `127.0.0.1`, e-mail de recuperação em português.
- **Migrações**: [`apply-migrations.sh`](apply-migrations.sh) em `/opt/audita-sistema/` aplica as pendentes de
  `/opt/audita-sistema/supabase/migrations` e registra em `supabase_migrations.schema_migrations`.
- **Site**: `/opt/audita-sistema` — [`web/docker-compose.yml`](web/docker-compose.yml), `web.env` (URL da API, chave
  publicável e `NEXT_PUBLIC_APP_ENV=producao`, 600), `.env` com `AUDITA_WEB_TAG` (versão em uso) e `releases/<data>/` com o
  código de cada versão. Imagem: [`web/Dockerfile`](web/Dockerfile).
- **Nginx**: [`nginx-audita-sistema.conf`](nginx-audita-sistema.conf) em `/etc/nginx/sites-available/audita-sistema`
  (o certbot acrescentou o HTTPS no arquivo da VPS) e [`nginx-conf.d/`](nginx-conf.d) em `/etc/nginx/conf.d/`. Certificado
  `audita.seg.br` (com `www` e `api`) emitido e renovado pela validação DNS do Cloudflare (`/root/.secrets/cloudflare.ini`).
- **Backup** diário 04h00: [`audita-sistema-backup.sh`](audita-sistema-backup.sh) → `/var/backups/audita-sistema` (banco
  completo, Storage, `.env` e `web.env`, 14 dias). Ficam no mesmo disco: copie periodicamente para fora da VPS.
  Cópia para o computador: `sh scripts/baixar-backup-vps.sh agora` (pasta `DocumentsAUDITA-BACKUP-VPS`, fora do Git).
- **Trocar de VPS**: [`MIGRAR-VPS.md`](MIGRAR-VPS.md). Nginx em uso (com o HTTPS do certbot): [`nginx-audita-sistema.certbot.conf`](nginx-audita-sistema.certbot.conf).
- **E-mail**: [`audita-email.sh`](audita-email.sh) instalado como `audita-email` (Brevo, `nao-responda@audita.seg.br`).

## Publicar uma nova versão do site

```bash
# no computador, na pasta do projeto: empacota os arquivos versionados (sem testes e documentos)
git ls-files | grep -vE "^(tests/|docs/|scripts/|_)" > /tmp/fontes.txt && tar -czf /tmp/audita-src.tgz -T /tmp/fontes.txt
scp /tmp/audita-src.tgz deploy/vps/web/Dockerfile root@164.68.112.61:/root/
# na VPS (R = data da versão, ex.: 20261016-1000)
mkdir -p /opt/audita-sistema/releases/$R && cd /opt/audita-sistema/releases/$R && tar -xzf /root/audita-src.tgz && cp /root/Dockerfile .
set -a && . /opt/audita-sistema/web.env && set +a
docker build -t audita-sistema:$R --build-arg NEXT_PUBLIC_SUPABASE_URL --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY --build-arg NEXT_PUBLIC_APP_ENV .
cd /opt/audita-sistema && printf "AUDITA_WEB_TAG=$R\n" > .env && docker compose up -d
```

**Voltar à versão anterior:** grave a data anterior em `/opt/audita-sistema/.env` (`AUDITA_WEB_TAG=…`) e rode
`docker compose up -d` em `/opt/audita-sistema`. Mantenha as 5 últimas imagens (`docker images audita-sistema`).

Migração nova: copie o `.sql` para `/opt/audita-sistema/supabase/migrations/` e rode `sh /opt/audita-sistema/apply-migrations.sh`
(antes, siga o procedimento do `CLAUDE.md`: aditiva, testada no PGlite).

## Site institucional (raiz de audita.seg.br)

- Código em `site/` (Next.js, páginas estáticas) e imagem em [`site/Dockerfile`](site/Dockerfile): Nginx enxuto
  ([`site/nginx.conf`](site/nginx.conf)) servindo `site/out`, container `audita-site` (serviço `site` do
  [`web/docker-compose.yml`](web/docker-compose.yml), tag em `AUDITA_SITE_TAG`, `127.0.0.1:3400`).
- Gerar: `docker build -f deploy/vps/site/Dockerfile -t audita-site:$R .` na pasta da versão (sem variáveis de ambiente:
  o site não fala com o banco). Depois, `docker compose up -d site`.
- Nginx: a raiz vai para o site; `/empresa` para o sistema; os endereços antigos do sistema (`/login`, `/clientes`…)
  são redirecionados para `/empresa/…`; `/treinamentos`, `/pagamentos/mercadopago` e `/email-templates` não mudam.
- Enquanto for prévia, o site sai com `noindex` (cabeçalho, meta e `robots.txt`). Na publicação (Etapa 7 do briefing),
  retirar os três.
- Testes: `npx next build site` e `npx playwright test -c playwright.site.config.ts` (computador e celular, sem banco).

## Studio (painel do Supabase do AUDITA)

Não fica exposto na internet. Túnel: `ssh -L 8100:127.0.0.1:8100 root@164.68.112.61` e abra `http://localhost:8100`
(usuário e senha `DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD` do `.env`).

## Comandos úteis (na VPS)

```bash
cd /opt/supabase-audita && docker compose ps          # serviços do banco
docker logs --tail 50 audita-web                       # site
docker exec -it audita-db psql -U postgres             # SQL
/usr/local/bin/audita-sistema-backup                   # backup imediato
audita-email status                                    # configuração de e-mail
```

Restaurar backup do banco: `gunzip -c db_<data>.sql.gz | docker exec -i audita-db psql -U supabase_admin -d postgres`.
