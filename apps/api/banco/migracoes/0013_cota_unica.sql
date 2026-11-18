-- Revisão 3: uma cota por unidade, mês, serviço e origem. A API e a importação já tratavam assim, mas o banco não impedia:
-- dois cliques em "Copiar do mês anterior" ao mesmo tempo podiam duplicar as cotas do mês e dobrar a meta de operações.
-- A migração confere o que já existe e PARA, dizendo quantas sobram, em vez de apagar qualquer coisa.

do $$
declare
  sobram int;
begin
  select coalesce(sum(n - 1), 0) into sobram
    from (select count(*) as n from cota group by unidade_id, mes, servico_id, origem having count(*) > 1) r;
  if sobram > 0 then
    raise exception 'Há % % (mesmo mês, serviço e origem): apague as repetidas na tela de Cotas antes de migrar.',
      sobram, case when sobram = 1 then 'cota repetida' else 'cotas repetidas' end;
  end if;
end $$;

create unique index cota_unica on cota (unidade_id, mes, servico_id, origem);
