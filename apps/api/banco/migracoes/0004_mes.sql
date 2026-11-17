-- O mês: cotas, voluntariado, alocações e permutas (esquema v0.1, seção 6)
create table cota (
  id uuid primary key default gen_random_uuid(),
  mes date not null check (extract(day from mes) = 1),
  unidade_id uuid not null references unidade (id),
  servico_id uuid not null references servico (id),
  quantidade int not null check (quantidade > 0),
  origem text not null check (origem in ('interna', 'externa')),
  prioridade int not null,
  conta_meta boolean not null default true
);

create function cota_servico_extra() returns trigger language plpgsql as $$
begin
  if (select tipo from servico where id = new.servico_id) not in ('pjes', 'diaria') then
    raise exception 'Cota só existe para serviço PJES ou diária';
  end if;
  return new;
end $$;

create trigger cota_servico before insert or update on cota
  for each row execute function cota_servico_extra();

create table voluntariado (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  data date not null,
  turno_padrao text not null check (turno_padrao in ('A', 'B')),
  origem text not null check (origem in ('manual', 'importacao', 'militar')),
  unique (militar_id, data, turno_padrao)
);

create table alocacao (
  id uuid primary key default gen_random_uuid(),
  militar_id uuid not null references militar (id),
  escala_id uuid not null references escala (id),
  servico_id uuid not null references servico (id),
  turno_id uuid not null references turno (id),
  data date not null,
  guarnicao_id uuid references guarnicao (id),
  funcao_id uuid references funcao (id),
  origem text not null check (origem in ('pre_escala', 'distribuicao', 'manual', 'permuta')),
  presente boolean,
  presenca_por uuid references usuario (id),
  presenca_em timestamptz,
  unique (militar_id, data, servico_id, turno_id)
);
create index alocacao_escala_data on alocacao (escala_id, data);

create function alocacao_coerente() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from escala_servico where escala_id = new.escala_id and servico_id = new.servico_id) then
    raise exception 'O serviço não faz parte desta escala';
  end if;
  if not exists (select 1 from turno where id = new.turno_id and servico_id = new.servico_id) then
    raise exception 'O turno não é deste serviço';
  end if;
  return new;
end $$;

create trigger alocacao_coerencia before insert or update on alocacao
  for each row execute function alocacao_coerente();

create table permuta (
  id uuid primary key default gen_random_uuid(),
  mes date not null check (extract(day from mes) = 1),
  registrada_por uuid references usuario (id),
  registrada_em timestamptz not null default now(),
  observacao text
);

create table permuta_item (
  id uuid primary key default gen_random_uuid(),
  permuta_id uuid not null references permuta (id),
  alocacao_id uuid not null unique references alocacao (id),
  militar_original_id uuid not null references militar (id)
);

-- exatamente 2 itens por permuta, conferido no fim da transação (RN-86)
create function permuta_dois_itens() returns trigger language plpgsql as $$
declare
  alvo uuid;
begin
  if tg_table_name = 'permuta' then
    alvo := new.id;
  elsif tg_op = 'DELETE' then
    alvo := old.permuta_id;
  else
    alvo := new.permuta_id;
  end if;
  if (select count(*) from permuta where id = alvo) = 1
     and (select count(*) from permuta_item where permuta_id = alvo) <> 2 then
    raise exception 'Uma permuta precisa de exatamente 2 itens';
  end if;
  return null;
end $$;

create constraint trigger permuta_itens_conta after insert or update or delete on permuta_item
  deferrable initially deferred for each row execute function permuta_dois_itens();

create constraint trigger permuta_conta after insert on permuta
  deferrable initially deferred for each row execute function permuta_dois_itens();
