-- Fase 4.3.2.1: serviços fixos (design de 20/11/2026). Pronto, Saldo, Expediente (ordinários) e JES (PJES) são os serviços de que o código
-- depende: o nome, o tipo e a situação deles não mudam. Eles são reconhecidos pelo nome, sem caixa e sem espaços nas pontas.

-- (1) um fixo com o tipo errado trava a migração, dizendo qual (o gatilho abaixo não deixaria o serviço existir assim)
do $$
declare
  errado record;
begin
  select s.nome, s.tipo into errado
    from servico s
   where (lower(btrim(s.nome)) in ('pronto', 'saldo', 'expediente') and s.tipo <> 'ordinario')
      or (lower(btrim(s.nome)) = 'jes' and s.tipo <> 'pjes')
   order by s.nome
   limit 1;
  if found then
    raise exception 'Há serviço fixo com o tipo errado: % (%). Corrija o tipo antes de migrar.', btrim(errado.nome), errado.tipo;
  end if;
end $$;

-- (2) a marca
alter table servico add column fixo boolean not null default false;

-- (3) marca os que já existem, apara o nome (o formulário sempre manda o nome aparado, e o gatilho recusa mudar o nome de um fixo) e reativa
-- os desativados (depois, ninguém conseguiria reativá-los)
update servico set fixo = true, ativo = true, nome = btrim(nome) where lower(btrim(nome)) in ('pronto', 'saldo', 'expediente', 'jes');

-- (4) cria os que faltam, com os turnos e as cores da carga de exemplo, nas seções que já têm algum serviço
do $$
declare
  u uuid;
  fixo record;
  novo uuid;
begin
  for u in select distinct unidade_id from servico loop
    for fixo in
      select * from (values
        ('Pronto', 'ordinario', '#2F8F5B', '08:00', '20:00', '20:00', '08:00'),
        ('Saldo', 'ordinario', '#2B7BB9', '08:00', '20:00', '20:00', '08:00'),
        ('JES', 'pjes', '#6E56A8', '08:00', '20:00', '20:00', '08:00'),
        ('Expediente', 'ordinario', '#8A94A1', '08:00', '16:00', null, null)
      ) as v (nome, tipo, cor, a_inicio, a_fim, b_inicio, b_fim)
    loop
      if not exists (select 1 from servico where unidade_id = u and lower(btrim(nome)) = lower(fixo.nome)) then
        insert into servico (unidade_id, nome, tipo, cor, fixo) values (u, fixo.nome, fixo.tipo, fixo.cor, true) returning id into novo;
        insert into turno (servico_id, letra, inicio, fim) values (novo, 'A', fixo.a_inicio::time, fixo.a_fim::time);
        if fixo.b_inicio is not null then
          insert into turno (servico_id, letra, inicio, fim) values (novo, 'B', fixo.b_inicio::time, fixo.b_fim::time);
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- (5) o gatilho: define `fixo` pelo nome e recusa o que um serviço fixo não pode
create function servico_fixo() returns trigger language plpgsql as $$
declare
  tipo_fixo text := case lower(btrim(new.nome))
    when 'pronto' then 'ordinario'
    when 'saldo' then 'ordinario'
    when 'expediente' then 'ordinario'
    when 'jes' then 'pjes'
  end;
begin
  if tg_op = 'UPDATE' and old.fixo and (new.nome is distinct from old.nome or new.tipo is distinct from old.tipo or not new.ativo) then
    if new.tipo is distinct from old.tipo and new.nome is not distinct from old.nome and new.ativo then
      raise exception 'O serviço % é fixo e precisa ser do tipo %.', old.nome, tipo_fixo;
    end if;
    raise exception 'O serviço % é fixo: o nome, o tipo e a situação não mudam.', old.nome;
  end if;
  if tipo_fixo is not null and new.tipo <> tipo_fixo then
    raise exception 'O serviço % é fixo e precisa ser do tipo %.', btrim(new.nome), tipo_fixo;
  end if;
  new.fixo := tipo_fixo is not null;
  return new;
end $$;

create trigger servico_fixo before insert or update on servico
  for each row execute function servico_fixo();
