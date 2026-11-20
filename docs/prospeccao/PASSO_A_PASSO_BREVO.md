# Passo a passo — conta Brevo da prospecção (decisão do Diretor de 19/11/2026)

Objetivo: enviar o e-mail de apresentação pelo próprio sistema, por uma **conta Brevo separada** da que envia os
e-mails de acesso (recuperação de senha). Se a prospecção receber denúncias de spam, só essa conta é afetada.

O domínio **audita.seg.br já está autenticado** no Brevo da conta atual (SPF, DKIM e DMARC). Na conta nova falta só
provar que o domínio é da AUDITA. A senha e as chaves ficam com você; nada disso passa pela conversa.

## 1. Criar a conta (5 min)
1. Acesse **brevo.com** → "Cadastre-se grátis".
2. Use um login **diferente** da conta atual (sugestão: engenharia.audita@outlook.com).
3. Preencha os dados da empresa com os mesmos dados institucionais do sistema e escolha o **plano gratuito**.
   O plano gratuito anuncia até 300 e-mails por dia e põe a marca do Brevo no rodapé.

## 2. Autenticar o domínio na conta nova (10 min)
1. No Brevo: menu do seu nome → **Remetentes, domínios e IPs dedicados** → aba **Domínios** → **Adicionar domínio**
   → `audita.seg.br`.
2. O Brevo mostra os registros de DNS. No **Cloudflare** (onde fica o DNS do audita.seg.br) → **DNS** → **Records**,
   adicione **somente os que o Brevo marcar como pendentes**. Normalmente é um registro TXT `brevo-code:…`.
   - **Não apague nem troque** o SPF existente (`v=spf1 include:spf.brevo.com -all`): ele já vale para as duas contas.
   - Se o Brevo pedir registros DKIM (`brevo1._domainkey` / `brevo2._domainkey`) que já existem, mantenha os existentes.
3. Volte ao Brevo e clique em **Autenticar/Verificar**. Aguarde ficar verde (pode levar alguns minutos).

## 3. Criar o remetente (2 min)
1. **Remetentes, domínios e IPs dedicados** → aba **Remetentes** → **Adicionar remetente**.
2. Nome: o seu nome + "| AUDITA" (ex.: "Vinicius | AUDITA"). E-mail: `prospeccao@audita.seg.br`.
3. As respostas vão para **engenharia.audita@outlook.com**: o sistema coloca esse endereço como "Responder para".
   Por isso não é preciso caixa de entrada no domínio.
   - **Se o Brevo pedir um código enviado para prospeccao@audita.seg.br:** no Cloudflare → **Email** →
     **Email Routing** → ative, crie o endereço `prospeccao@audita.seg.br` e encaminhe para
     engenharia.audita@outlook.com (gratuito). Ao ativar, o Cloudflare propõe mudar o SPF: o registro final precisa
     ter **os dois**: `v=spf1 include:_spf.mx.cloudflare.net include:spf.brevo.com -all`.

## 4. Gerar a chave de envio (2 min)
1. Menu do seu nome → **SMTP e API** → aba **Chaves de API** → **Gerar nova chave de API** → nome
   "Sistema AUDITA — prospecção". A chave começa com `xkeysib-`. **Não** use a aba "Chaves SMTP".
2. **Não envie a chave pela conversa.** No sistema (como administrador): **Configurações → E-mail da prospecção**.
   Preencha o nome do remetente, cole a chave no campo "Chave do Brevo" e salve. Ela é guardada **cifrada** no servidor
   e nunca volta para a tela.
3. Para liberar o **envio em lote**, preencha na mesma tela a **data da validação jurídica**. Sem ela, só o envio
   individual pelo cartão funciona.

## 5. Me avise
Basta dizer "Brevo pronto". Eu confiro a configuração e combinamos um teste para um e-mail seu. O envio em lote fica liberado
quando você me informar a **data da validação do advogado** (Avaliação de Legítimo Interesse, já enviada).
