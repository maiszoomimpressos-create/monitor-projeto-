-- Multiusuário: tabela de usuários e dono (ownerId) em projects.
-- APLICADA no banco de controle de produção (Neon) em 14/10/2026.

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
