-- Multiusuário: tabela de usuários e dono (ownerId) em projects.
-- NÃO aplicada em nenhum banco. Aplicar manualmente com `npm run db:migrate:deploy`
-- somente com autorização do usuário.

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "projects" ADD COLUMN "ownerId" TEXT;

CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
