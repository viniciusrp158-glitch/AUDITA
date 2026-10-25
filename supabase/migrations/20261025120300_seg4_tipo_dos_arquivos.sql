-- AUDITA — Correções da auditoria de segurança (25/10/2026), achado 11: training_files.mime_type era texto livre e a
-- área do aluno o usava como Content-Type ao exibir o arquivo (um administrador, pela API, podia gravar 'text/html' e
-- servir HTML/SVG executável em audita.seg.br). A rota passou a usar uma lista fechada; aqui o banco também passa a
-- aceitar só os tipos que o sistema grava (src/lib/training/labels.ts, MIME_BY_EXT):
--   * arquivos do aluno (apostila e ficha técnica): PDF, PNG, JPEG ou WebP;
--   * arquivos da equipe: os mesmos, mais DOCX e PPTX (roteiros, gabaritos e slides).
-- Somente acréscimo: restrição criada NOT VALID e validada em seguida (produção, 25/10/2026: nenhum arquivo fora de
-- PDF/PNG/JPEG/WebP).

alter table audita.training_files add constraint training_files_mime_allowed check (
  mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  and (kind not in ('apostila', 'ficha_tecnica') or mime_type in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp'))
) not valid;
alter table audita.training_files validate constraint training_files_mime_allowed;

notify pgrst, 'reload schema';
