-- Fase 7.1: o militar marca o próprio voluntariado quando a coleta da unidade dele está aberta (decisões 1 a 8 do design de 25/11/2026).
-- (1) A coleta: uma linha por unidade e mês; existir a linha é estar aberta, e fechar é apagá-la. A coluna `id` existe só para a auditoria gravar o registro.
create table voluntariado_coleta (
  id uuid not null unique default gen_random_uuid(),
  unidade_id uuid not null references unidade (id),
  mes date not null check (extract(day from mes) = 1),
  aberta_por uuid references usuario (id),
  aberta_em timestamptz not null default now(),
  primary key (unidade_id, mes)
);
create trigger auditoria_registro after insert or update or delete on voluntariado_coleta
  for each row execute function registrar_auditoria();

-- (2) Quem fez o lançamento do mês: o próprio militar ou o escalante (só o do militar pede registro quando o escalante corrige).
alter table voluntariado_lancamento add column pelo_militar boolean not null default false;

-- (3) O registro das exceções: a correção do escalante num mês que o militar preencheu e (fase 7.3) a alteração no passado de uma escala lançada.
-- Só de acréscimo: a aplicação não atualiza nem apaga; por isso não leva gatilho de auditoria (ele próprio é o histórico).
create table registro_de_alteracao (
  id uuid primary key default gen_random_uuid(),
  em timestamptz not null default now(),
  usuario_id uuid not null references usuario (id),
  unidade_id uuid not null references unidade (id),
  tipo text not null check (tipo in ('voluntariado_corrigido', 'escala_no_passado')),
  militar_id uuid references militar (id),
  escala_id uuid references escala (id),
  mes date not null check (extract(day from mes) = 1),
  data date,
  antes jsonb,
  depois jsonb,
  justificativa text,
  check (tipo <> 'escala_no_passado' or (escala_id is not null and coalesce(char_length(btrim(justificativa)), 0) >= 10)),
  check (tipo <> 'voluntariado_corrigido' or militar_id is not null)
);
create index registro_de_alteracao_escala on registro_de_alteracao (escala_id, mes);
create index registro_de_alteracao_militar on registro_de_alteracao (militar_id, mes);
