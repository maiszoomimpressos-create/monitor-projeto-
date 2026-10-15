-- E-mail da conta (Supabase/hospedagem) onde o projeto foi criado: só referência.
-- NÃO aplicada em nenhum banco. Aplicar no Neon (npm run db:migrate:deploy)
-- ANTES do deploy desta versão, com autorização do usuário.
ALTER TABLE "projects" ADD COLUMN "accountEmail" TEXT;
