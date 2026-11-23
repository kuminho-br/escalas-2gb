-- Fase 6, entrega 9: o quadro e a situação do militar passam a valer por período (no rastreio), como a lotação, e a ficha ganha os dados pessoais.
-- Pode rodar de novo: cada passo confere antes de mudar, e a ordem importa (copia o que está no militar antes de tirar as colunas dele).

-- o catálogo das situações do militar (como os tipos de afastamento): "pode ser escalado" decide se ele entra nas escalas
create table if not exists situacao_militar (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (btrim(nome) <> ''),
  escalavel boolean not null default false,
  ativo boolean not null default true
);
create unique index if not exists situacao_militar_nome on situacao_militar (lower(nome));
insert into situacao_militar (nome, escalavel)
select v.nome, v.escalavel
  from (values ('Ativa', true), ('Reserva', false), ('Agregado', false), ('Adido', false), ('Desativado', false)) as v (nome, escalavel)
 where not exists (select 1 from situacao_militar s where lower(s.nome) = lower(v.nome));
drop trigger if exists auditoria_registro on situacao_militar;
create trigger auditoria_registro after insert or update or delete on situacao_militar
  for each row execute function registrar_auditoria();

-- o rastreio ganha o quadro e a situação
alter table rastreio add column if not exists quadro_id uuid references quadro (id);
alter table rastreio add column if not exists situacao_id uuid references situacao_militar (id);

do $$
begin
  -- o quadro do militar vai para todos os períodos dele
  if exists (select 1 from information_schema.columns where table_name = 'militar' and column_name = 'quadro_id') then
    update rastreio r set quadro_id = m.quadro_id from militar m where m.id = r.militar_id and r.quadro_id is null and m.quadro_id is not null;
  end if;
  -- quem estava inativo vai para "Desativado"; os outros, para "Ativa"
  if exists (select 1 from information_schema.columns where table_name = 'militar' and column_name = 'ativo') then
    update rastreio r set situacao_id = (select id from situacao_militar where lower(nome) = case when m.ativo then 'ativa' else 'desativado' end)
      from militar m where m.id = r.militar_id and r.situacao_id is null;
  end if;
  update rastreio set situacao_id = (select id from situacao_militar where lower(nome) = 'ativa') where situacao_id is null;
end $$;
alter table rastreio alter column situacao_id set not null;

-- um período aberto por quem não diz a situação (importações, carga) nasce "Ativa"
create or replace function rastreio_situacao_padrao() returns trigger language plpgsql as $$
begin
  if new.situacao_id is null then
    new.situacao_id := (select id from situacao_militar where lower(nome) = 'ativa');
  end if;
  return new;
end $$;
drop trigger if exists rastreio_situacao on rastreio;
create trigger rastreio_situacao before insert on rastreio for each row execute function rastreio_situacao_padrao();

-- os dados pessoais: o ano do nascimento, o CPF e o endereço
alter table militar
  add column if not exists nascimento_ano smallint,
  add column if not exists cpf text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text;

-- com o ano, a data precisa existir (29/02 só em ano bissexto); o ano não vive sem dia e mês
alter table militar drop constraint if exists militar_nascimento_ano_valido;
alter table militar add constraint militar_nascimento_ano_valido check (
  case
    when nascimento_ano is null then true
    when nascimento_dia is null or nascimento_mes is null or nascimento_mes not between 1 and 12 then false
    else nascimento_ano between 1900 and 2100
         and nascimento_dia <= extract(day from (make_date(nascimento_ano, nascimento_mes, 1) + interval '1 month' - interval '1 day'))
  end
);
alter table militar drop constraint if exists militar_cpf_formato;
alter table militar add constraint militar_cpf_formato check (cpf is null or cpf ~ '^\d{11}$');
create unique index if not exists militar_cpf_unico on militar (cpf);
alter table militar drop constraint if exists militar_cep_formato;
alter table militar add constraint militar_cep_formato check (cep is null or cep ~ '^\d{8}$');
alter table militar drop constraint if exists militar_endereco_curto;
alter table militar add constraint militar_endereco_curto check (
  coalesce(char_length(logradouro), 0) <= 120 and coalesce(char_length(numero), 0) <= 120 and coalesce(char_length(complemento), 0) <= 120
  and coalesce(char_length(bairro), 0) <= 120 and coalesce(char_length(cidade), 0) <= 120
);
alter table militar drop constraint if exists militar_uf_valida;
alter table militar add constraint militar_uf_valida check (
  uf is null or uf in ('AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO')
);

-- por último, saem do militar o que passou ao período: o posto no quadro vira regra da API; o "ativo", a situação do período
alter table militar drop constraint if exists militar_posto_no_quadro;
alter table militar drop column if exists quadro_id;
alter table militar drop column if exists ativo;
