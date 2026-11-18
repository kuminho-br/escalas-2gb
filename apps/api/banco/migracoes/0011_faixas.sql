-- Entrega 4.2 (adendo de 18/11/2026): sem turno único (U vira A) e vínculo da escala por faixa de horário.

do $$
begin
  if exists (
    select 1 from turno u where u.letra = 'U'
       and exists (select 1 from turno a where a.servico_id = u.servico_id and a.letra = 'A')
  ) then
    raise exception 'Há serviço com turno A e turno U: troque um deles antes de migrar.';
  end if;
end $$;

-- cada vínculo por letra (ou "todos os turnos", turno_letra nulo) vira uma marcação por faixa dos serviços da escala;
-- o vínculo cuja letra não existe em nenhum serviço da escala (órfão) não gera nada
create temp table vinculo_por_faixa as
select distinct eg.versao_id, eg.guarnicao_id, t.inicio, t.fim
  from escala_guarnicao eg
  join escala_vinculo_versao v on v.id = eg.versao_id
  join escala_servico es on es.escala_id = v.escala_id
  join turno t on t.servico_id = es.servico_id
 where eg.turno_letra is null or t.letra = eg.turno_letra;

delete from escala_guarnicao;
alter table escala_guarnicao drop column turno_letra;
alter table escala_guarnicao add column inicio time not null;
alter table escala_guarnicao add column fim time not null;
alter table escala_guarnicao add constraint escala_guarnicao_faixa_unica unique (versao_id, guarnicao_id, inicio, fim);
insert into escala_guarnicao (versao_id, guarnicao_id, inicio, fim)
  select versao_id, guarnicao_id, inicio, fim from vinculo_por_faixa;
drop table vinculo_por_faixa;

-- serviço de um turno só usa o A
update turno set letra = 'A' where letra = 'U';
alter table turno drop constraint turno_letra_check;
alter table turno add constraint turno_letra_check check (letra in ('A', 'B', 'C'));
