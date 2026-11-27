-- 6.72: a cota perde a origem (interna ou externa) e ganha os dias.
-- As cotas do mesmo serviço, mês e unidade (a interna e a externa) viram uma só: a quantidade é a soma e a prioridade é a menor das duas.
-- A cota que já estava sozinha não muda. Ninguém perde o que foi escalado: a contagem das distribuídas (as alocações do serviço no mês) não depende da origem.
update cota c
   set quantidade = g.soma, prioridade = g.menor
  from (
    select (array_agg(id order by prioridade, id))[1] as id, sum(quantidade)::int as soma, min(prioridade) as menor
      from cota group by unidade_id, mes, servico_id having count(*) > 1
  ) g
 where c.id = g.id;

delete from cota c
 where exists (
   select 1 from cota k
    where k.unidade_id = c.unidade_id and k.mes = c.mes and k.servico_id = c.servico_id and k.id <> c.id
      and (k.prioridade, k.id::text) < (c.prioridade, c.id::text)
 );

drop index cota_unica;
alter table cota drop column origem;
create unique index cota_unica on cota (unidade_id, mes, servico_id);

-- os dias da cota: o dia obrigatório (mínimo 1), o dia com meta (mínimo N) e, no banco e na regra, o máximo do dia (sem tela por agora).
-- O resto do total do mês vale nos outros dias. `id` só serve à auditoria.
create table cota_dia (
  id uuid not null default gen_random_uuid() unique,
  cota_id uuid not null references cota (id) on delete cascade,
  data date not null,
  minimo int not null check (minimo >= 1),
  maximo int check (maximo is null or maximo >= minimo),
  primary key (cota_id, data)
);

create function cota_dia_do_mes() returns trigger language plpgsql as $$
begin
  if date_trunc('month', new.data)::date <> (select mes from cota where id = new.cota_id) then
    raise exception 'O dia precisa ser do mês da cota.';
  end if;
  return new;
end $$;

create trigger cota_dia_mes before insert or update on cota_dia
  for each row execute function cota_dia_do_mes();
create trigger auditoria_registro after insert or update or delete on cota_dia
  for each row execute function registrar_auditoria();
