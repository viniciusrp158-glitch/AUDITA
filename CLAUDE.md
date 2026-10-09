# Regras do projeto AUDITA (para pessoas e IAs que continuarem o desenvolvimento)

1. A referência oficial é o **AUDDOC017 — Rev.00** e os documentos AUDDOC001–015. Em divergência, prevalecem os documentos aprovados; apresente o conflito ao Diretor antes de decidir.
2. **Nunca** acessar, alterar ou migrar tabelas do Audita PRO / Audita HUB. Tudo do AUDITA vive no schema `audita`.
3. Migrações apenas **aditivas**, em `supabase/migrations/`, com o mesmo nome/versão aplicados no banco. Nada destrutivo sem aprovação expressa.
4. RLS obrigatória em toda tabela nova; GRANT explícito e mínimo; nada para `anon`. Funções SECURITY DEFINER com `search_path = ''`.
5. Sem exclusão física de cadastros, propostas e documentos: usar inativação lógica. Revisões emitidas são imutáveis.
6. Não inventar dados institucionais, CNPJ, tributos, margens ou valores. Parâmetros ausentes ⇒ **PENDENTE**, sem preço.
7. Dados fictícios somente no ambiente de desenvolvimento e sempre identificados como teste.
8. Cálculos financeiros: fórmulas exatas do AUDDOC011, aritmética decimal exata, margens comparadas com 4 casas decimais.
9. Nenhuma chave privilegiada (service_role, IA) no navegador ou no Git.
10. Interface em pt-BR, BRL, dd/mm/aaaa, fuso America/Sao_Paulo; identidade visual do AUDDOC003.
11. Um módulo só é concluído com testes executados e evidência registrada em `docs/HISTORICO.md`.
