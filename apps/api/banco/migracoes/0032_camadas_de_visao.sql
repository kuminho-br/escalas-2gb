-- Entrega 6.11: as camadas de visão. O acesso passa a ter duas perguntas separadas: o que a pessoa EDITA (pela hierarquia, como antes) e o que ela
-- VÊ (por camadas que se somam: todos, oficial e chefe de divisão). Aqui ficam a marca "de oficiais" do quadro e a borda (quais blocos cada
-- camada vê), que o administrador ajusta nas Configurações.
-- Pode rodar de novo: a coluna só é criada (e QOC e QOA só marcados) na primeira vez, e a borda não perde o que o administrador ajustou.

-- quem está num quadro "de oficiais" tem a camada do oficial (o quadro do período de hoje); QOC e QOA nascem marcados
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = current_schema() and table_name = 'quadro' and column_name = 'oficial') then
    alter table quadro add column oficial boolean not null default false;
    update quadro set oficial = true where sigla in ('QOC', 'QOA');
  end if;
end $$;

-- a borda: uma marca por bloco e camada (o id só serve à auditoria, como nas outras tabelas de chave natural)
create table if not exists visao_bloco (
  id uuid not null default gen_random_uuid() unique,
  bloco text not null check (bloco in ('identificacao', 'contato', 'situacao', 'afastamentos', 'dados_da_escala', 'comportamento', 'escala_em_montagem')),
  camada text not null check (camada in ('todos', 'oficial', 'chefe_divisao')),
  ve boolean not null,
  primary key (bloco, camada),
  -- sem a identificação a consulta não mostra nada: ela não se desliga para todos
  check (ve or not (bloco = 'identificacao' and camada = 'todos'))
);

-- a borda inicial (spec, "Os blocos e a borda inicial"); o administrador muda na tela
insert into visao_bloco (bloco, camada, ve) values
  ('identificacao', 'todos', true), ('identificacao', 'oficial', true), ('identificacao', 'chefe_divisao', true),
  ('contato', 'todos', false), ('contato', 'oficial', true), ('contato', 'chefe_divisao', true),
  ('situacao', 'todos', false), ('situacao', 'oficial', true), ('situacao', 'chefe_divisao', true),
  ('afastamentos', 'todos', false), ('afastamentos', 'oficial', true), ('afastamentos', 'chefe_divisao', true),
  ('dados_da_escala', 'todos', false), ('dados_da_escala', 'oficial', true), ('dados_da_escala', 'chefe_divisao', true),
  ('comportamento', 'todos', false), ('comportamento', 'oficial', false), ('comportamento', 'chefe_divisao', true),
  ('escala_em_montagem', 'todos', false), ('escala_em_montagem', 'oficial', false), ('escala_em_montagem', 'chefe_divisao', true)
on conflict (bloco, camada) do nothing;

drop trigger if exists auditoria_registro on visao_bloco;
create trigger auditoria_registro after insert or update or delete on visao_bloco
  for each row execute function registrar_auditoria();

-- a marca "de oficiais" muda quem tem a camada do oficial: entra na auditoria (o quadro era fixo e nunca foi auditado)
drop trigger if exists auditoria_registro on quadro;
create trigger auditoria_registro after insert or update or delete on quadro
  for each row execute function registrar_auditoria();
