-- Fase 4.2.1: ordem de escala (design de 18/11/2026, Parte 1). Uma lista por escala, com vigência por mês, da vez de cada vaga
-- (guarnição + função + número da vaga). Substitui a prioridade da guarnição como regra de quem é preenchido primeiro.

create table ordem_escala_versao (
  id uuid primary key default gen_random_uuid(),
  escala_id uuid not null references escala (id),
  vigencia_desde date not null check (extract(day from vigencia_desde) = 1),
  unique (escala_id, vigencia_desde)
);

create table ordem_escala_item (
  -- o id só serve à auditoria (que exige um registro_id); a chave de verdade é (versão, posição)
  id uuid not null default gen_random_uuid() unique,
  versao_id uuid not null references ordem_escala_versao (id) on delete cascade,
  posicao int not null check (posicao >= 1),
  guarnicao_id uuid not null references guarnicao (id),
  funcao_id uuid not null references funcao (id),
  vaga int not null check (vaga >= 1),
  primary key (versao_id, posicao),
  unique (versao_id, guarnicao_id, funcao_id, vaga)
);

create trigger auditoria_registro after insert or update or delete on ordem_escala_versao
  for each row execute function registrar_auditoria();
create trigger auditoria_registro after insert or update or delete on ordem_escala_item
  for each row execute function registrar_auditoria();
