# Servidor dos 3 sistemas Audita: VPS própria do Diretor

Kit para levar **Sistema AUDITA** (com área do aluno e site), **Audita PRO** e **Audita HUB** da VPS 1 do Leandro (onde
rodam desde 21/10/2026) para a VPS própria do Diretor, com a mesma estrutura em Docker. Tudo o que é configuração está
aqui; dados e segredos vêm dos backups (nunca do Git).

| Pasta | O que é | Na VPS 1 |
|---|---|---|
| `borda/` | Nginx com HTTPS (portas 80/443) e certificados Let's Encrypt por DNS do Cloudflare | Nginx Proxy Manager do Leandro (`referencia-vps1/`) |
| `proxy/` | Nginx interno com as regras de cada sistema (`conf.d/audita.conf`, `auditapro.conf`, `auditahub.conf`) | `~/audita/proxy` |
| `supabase-pro-hub/` | ajuste da pilha Supabase do PRO + HUB (`docker-compose.vps.yml`) | `~/audita/supabase` |
| `supabase-audita/` | ajustes da pilha Supabase do AUDITA (`docker-compose.vps.yml` + `vps1.yml` com o Mailpit) | `~/audita/supabase-audita` |
| `supabase-audita-dev/` | ambiente de desenvolvimento do AUDITA (opcional) | `~/audita/supabase-audita-dev` |
| `audita-sistema/` | containers `audita-web`, `audita-aluno` e `audita-site` | `~/audita/audita-sistema` |
| `auditahub/` | container `auditahub-web` | `~/audita/auditahub` |
| `bin/` | backups, e-mail (Brevo), notificações do HUB e renovação dos certificados | `~/audita/bin` |
| `cron/` | agenda dos scripts (usuário `deploy`) | crontab do `deploy` |

Os caminhos usam `/home/deploy/audita`, como na VPS 1: criar o usuário `deploy` na VPS nova evita qualquer ajuste.

## Estado: migração concluída em 26/10/2026

Os 3 sistemas rodam na VPS do Diretor **164.68.112.61** (porta SSH 22; `root` e `deploy`, só chave), já com as correções
da auditoria de segurança de 25/10/2026 (ramos `fix/seguranca-auditoria` dos 3 repositórios). DNS trocado às 10h29 de
26/10 pela API do Cloudflare (8 registros A; `audita.seg.br` segue com proxy laranja). A VPS 1 (109.205.179.53) ficou
com os containers do Audita **parados, não apagados**, e os 4 crons comentados: volta = registros A de volta para
109.205.179.53 e `docker compose start` das pilhas lá. Apagar a VPS 1 só depois de 02/11/2026, com o OK do Diretor.

O que foi diferente do roteiro abaixo (para a próxima vez):
- A VPS já tinha um AUDITA antigo (21/10) com Nginx + certbot no host: backup em `/root/backup-antes-migracao-20261025`,
  depois `docker compose down` em `/opt/supabase-audita` e `/opt/audita-sistema`, `systemctl disable --now nginx
  certbot.timer`. A borda (`borda/`) passou a ocupar 80/443.
- O `deploy` da VPS nova tem uid 1001 (o 1000 é `ubuntu`): depois de copiar as pilhas, trocar o dono dos arquivos de
  uid 1000 (`find … -uid 1000 -exec chown -h 1001:1001`), sem mexer em `volumes/db/data`. O `auditahub-web` roda como
  1000:1000, então a release do HUB fica com dono 1000.
- Dados: cópia **fria** das pastas `supabase/` e `supabase-audita/` inteiras e dos volumes `supabase_db-config` e
  `supabase-audita_db-config` (chave do Vault com as credenciais do Mercado Pago), com as pilhas paradas, via `tar` num
  container alpine (o tar do alpine aceita um só `-C`: usar caminhos a partir de `/`). As vendas foram fechadas antes e
  reabertas depois.
- Variável nova `VITRINE_CHAVE_INTERNA` (mesmo valor em `audita-sistema/web.env` e `supabase-audita/.env`).
- O token do Cloudflare em `~/.config/secrets/cloudflare-audita.ini` não tem validade (certificados e DNS). A API do
  Cloudflare recusa o `User-Agent` padrão do Python: mandar um próprio.

**Nunca vão para o Git:** os `.env` das pilhas Supabase, `web.env`, `proxy/htpasswd/`, `borda/letsencrypt/`, o token do
Cloudflare e os backups.

## Fase 0 — Antes (sem parar nada)

1. **VPS nova:** Ubuntu 24.04, 4 vCPU, 8 GB de RAM e 80 GB de disco ou mais (hoje o conjunto usa ~2 GB de código e
   imagens Docker de ~4 GB; gerar uma imagem nova consome ~6 GB temporários).
2. **Acesso:** usuário com `sudo` e a chave pública do operador em `~/.ssh/authorized_keys`. Porta SSH diferente da 22,
   login por senha e de root desligados (`PasswordAuthentication no`, `PermitRootLogin no`).
3. **Código:** os ramos usados em produção, cada um no GitHub do Diretor:
   - AUDITA: o ramo com todo o trabalho até o site institucional (ver "GitHub" abaixo);
   - AuditaPRO: `feat/vps-interface-b16`;
   - AUDITAHUB: `develop`.

## Fase 1 — Preparar a VPS nova

```bash
# como root/sudo
adduser --disabled-password --gecos "" deploy && usermod -aG docker deploy   # depois de instalar o Docker
apt-get update && apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades apache2-utils
curl -fsSL https://get.docker.com | sh
ufw default deny incoming && ufw allow <porta-ssh>/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
```

Atenção: o Docker publica portas por fora do UFW. Por isso **todas** as portas dos containers deste kit ficam em
`127.0.0.1`, e só a `borda` publica 80/443.

Como `deploy`:

```bash
mkdir -p ~/audita/{proxy,borda,bin,logs/auditapro,auditapro,auditahub,audita-sistema} ~/backups ~/.config/secrets
docker network create supabase_default; docker network create supabase-audita_default   # se as pilhas ainda não criaram
```

Copiar este kit para `~/audita` (as pastas com o mesmo nome) e:

- `proxy/htpasswd/`: recriar as senhas das caixas de teste (`htpasswd -c audita-caixa.htpasswd <usuario>` e
  `auditapro-caixa.htpasswd`).
- `~/.config/secrets/cloudflare-audita.ini` (600): `dns_cloudflare_api_token = <token>` com Zone:Read + DNS:Edit
  nas zonas `audita.seg.br`, `auditapro.app.br` e `auditahub.app.br`, sem validade.
- Certificados (antes de trocar o DNS, pois a validação é por DNS):

  ```bash
  for par in "audita-sistema audita.seg.br,www.audita.seg.br,api.audita.seg.br" \
             "audita-pro auditapro.app.br,www.auditapro.app.br,api.auditapro.app.br" \
             "audita-hub auditahub.app.br,www.auditahub.app.br"; do
    set -- $par
    docker run --rm -v ~/audita/borda/letsencrypt:/etc/letsencrypt -v ~/.config/secrets/cloudflare-audita.ini:/cf.ini:ro \
      certbot/dns-cloudflare:v5.3.0 certonly --dns-cloudflare --dns-cloudflare-credentials /cf.ini \
      --cert-name $1 -d $2 --agree-tos -m engenharia.audita@outlook.com -n
  done
  ```

## Fase 2 — Ensaio (sem parar a VPS 1)

1. **Pilhas Supabase:** baixar o Supabase self-hosted `v0.8.2` em `~/audita/supabase` (PRO + HUB) e
   `~/audita/supabase-audita` (AUDITA), copiar os `docker-compose.vps*.yml` deste kit e o `.env` **do backup**. As chaves
   (`JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`) precisam ser as mesmas: elas assinam as sessões e estão gravadas nos
   sites.
2. **Dados:** restaurar o backup mais recente de cada pilha. O procedimento e as lições (recarga dos `COPY auth.*` com
   `session_replication_role = replica`, `auth.schema_migrations`, restrições) estão em `../vps/MIGRAR-VPS.md` (passos
   3 e 4) e na seção "Trazer os dados" do LEIA-ME da VPS 1.
3. **Funções:** copiar `volumes/functions` de cada pilha (AUDITA: `alunos`, `certificado`, `vitrine`, `mercadopago`,
   `usuarios`; PRO/HUB: as do repositório) e `docker compose restart functions`. As credenciais do Mercado Pago ficam
   no Vault do banco e vêm com o dump.
4. **Sites:** publicar como na VPS 1, ou seja, gerar as imagens `audita-sistema`, `audita-aluno` e `audita-site` (ver
   `../vps/README.md`), as telas do PRO em `~/audita/auditapro/www/current` e o HUB em `~/audita/auditahub/current`.
   Subir: `audita-sistema/` (`docker compose up -d`), `auditahub/`, `proxy/` e `borda/`.
5. **Conferir pelo IP, sem DNS:**

   ```bash
   curl -sk --resolve audita.seg.br:443:<IP> https://audita.seg.br/empresa/login -o /dev/null -w "%{http_code}\n"
   ```

   Fazer o mesmo para `/treinamentos/entrar`, `/`, `api.audita.seg.br/auth/v1/health`, `auditapro.app.br` e
   `auditahub.app.br`. Comparar as contagens das tabelas com as da VPS 1.

## Fase 3 — Troca (à noite, com janela combinada)

1. Na tela Treinamentos › Vendas, **fechar as vendas** (evita compra no meio da troca).
2. VPS 1: parar a escrita (`docker compose stop` dos sites; as pilhas Supabase ficam de pé só para o dump), rodar os 3
   backups (`~/audita/bin/*-backup`) e copiar para a VPS nova (`scp -P 58212`).
3. VPS nova: restaurar esses backups por cima do ensaio e conferir as contagens.
4. **Cloudflare (só com a autorização do Diretor):** trocar os registros A de `audita.seg.br` (`@`, `www`, `api`),
   `auditapro.app.br` (`@`, `www`, `api`) e `auditahub.app.br` (`@`, `www`) para o IP novo. Manter como estão o
   proxy laranja do AUDITA e o TXT/SPF/DMARC da Brevo.
5. **Conferência:**
   - login nos 3 sistemas;
   - Biblioteca abrindo PDF;
   - área do aluno e certificado;
   - "Esqueci minha senha" entregue;
   - aviso do Mercado Pago, com um aviso de teste do painel do MP chegando com 200;
   - notificações do HUB e backups no cron;
   - reabrir as vendas.
6. Instalar o cron (`crontab cron/crontab-audita`, já com os caminhos do kit).

## Fase 4 — Depois

- **VPS 1 de reserva:** deixar os containers do Vinícius parados (não apagados) por 7 dias. Voltar = registros A de volta
  ao IP `109.205.179.53` e `docker compose start`.
- Passados os 7 dias, com o OK do Diretor e do Leandro: apagar os containers, volumes e o bloco Audita do NPM da VPS 1,
  e revogar o token do Cloudflare e as chaves de acesso que não forem mais usadas.

## GitHub

- **AUDITA:** o trabalho de treinamentos, vendas e site está em ramos empilhados (o último é `feat/site-institucional`).
  O `develop` está 34 commits atrás. Antes da troca, juntar no `develop` (e no `main`, se o Diretor usar o `main` como
  produção) para a VPS nova publicar de um ramo só.
- **AuditaPRO:** produção = `feat/vps-interface-b16` (18 commits à frente do `main`).
- **AUDITAHUB:** produção = `develop`.
