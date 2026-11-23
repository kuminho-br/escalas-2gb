-- Entrega 6.10: as divisões entram na árvore, entre o grupamento e a seção, e nasce o nível de acesso "chefe de divisão".
-- Pode rodar de novo: nada é duplicado.

-- o nível é único: a seção desce para 5 antes de a divisão ocupar o 4.
-- A auditoria exige um "id", que esta tabela (de chave "codigo", fixa no sistema) não tem: fica desligada só durante a troca.
alter table tipo_unidade disable trigger auditoria_registro;
update tipo_unidade set nivel = 5 where codigo = 'secao' and nivel = 4;
insert into tipo_unidade (codigo, nome, nivel) values ('divisao', 'Divisão', 4) on conflict (codigo) do nothing;
alter table tipo_unidade enable trigger auditoria_registro;

-- as duas divisões padrão, vazias, em cada grupamento que ainda não tem divisão (quais seções vão para cada uma é dado: decide o gestor, na tela)
insert into unidade (tipo, sigla, nome, mae_id, desde)
select 'divisao', v.sigla, v.nome, g.id, date_trunc('month', current_date)::date
  from unidade g
 cross join (values ('DA', 'Divisão Administrativa'), ('DivOp', 'Divisão Operacional')) as v (sigla, nome)
 where g.tipo = 'grupamento'
   and (g.ate is null or g.ate >= current_date)
   and not exists (select 1 from unidade d where d.mae_id = g.id and d.tipo = 'divisao');

alter table papel_usuario drop constraint if exists papel_usuario_papel_check;
alter table papel_usuario add constraint papel_usuario_papel_check check (papel in ('administrador', 'gestor', 'chefe_divisao', 'escalante'));

-- o chefe de divisão só existe numa divisão (como o administrador só existe na raiz)
create or replace function papel_chefe_na_divisao() returns trigger language plpgsql as $$
begin
  if new.papel = 'chefe_divisao'
     and not exists (select 1 from unidade where id = new.unidade_id and tipo = 'divisao') then
    raise exception 'Chefe de divisão só existe numa divisão.';
  end if;
  return new;
end $$;

drop trigger if exists papel_chefe_divisao on papel_usuario;
create trigger papel_chefe_divisao before insert or update on papel_usuario
  for each row execute function papel_chefe_na_divisao();
