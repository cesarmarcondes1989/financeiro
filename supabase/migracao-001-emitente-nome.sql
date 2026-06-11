-- Migração 001: nome do estabelecimento na nota fiscal
-- Execute no SQL Editor do Supabase se você já criou as tabelas antes desta versão.

alter table notas_fiscais add column if not exists emitente_nome text;
