-- Migração 002: adiciona coluna municipio à tabela notas_fiscais
-- Execute este arquivo no SQL Editor do Supabase (uma única vez).

ALTER TABLE notas_fiscais
  ADD COLUMN IF NOT EXISTS municipio text;
