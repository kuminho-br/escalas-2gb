-- Fase 6, entrega 5: o rastreio (lotação, equipe, jornada) vale por dia, como os afastamentos.
-- Tira só a regra "desde é o dia 1" do rastreio; a da unidade (que também exige o dia 1) fica. Os períodos que já começam no dia 1 não mudam.
-- Pode rodar de novo: procura a regra pelo que ela diz, não pelo nome.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = to_regclass('rastreio') and contype = 'c' and pg_get_constraintdef(oid) ilike '%extract(day from desde)%'
  loop
    execute format('alter table rastreio drop constraint %I', c.conname);
  end loop;
end $$;
