-- Fase 5, entrega 2: a ficha do militar com os atributos do Pecúlio já decididos, e o afastamento com motivo e boletim.
-- D7: sem CPF e sem o ano de nascimento (o nascimento guarda só dia e mês). O motivo do afastamento não guarda diagnóstico.
-- Pode rodar de novo: colunas com "if not exists", restrições recriadas e tipos de afastamento sem duplicar.

alter table militar
  add column if not exists nome_completo text,
  add column if not exists sexo text,
  add column if not exists nascimento_dia smallint,
  add column if not exists nascimento_mes smallint,
  add column if not exists telefone text,
  add column if not exists email text,
  add column if not exists comportamento text,
  add column if not exists comportamento_boletim text;

alter table militar drop constraint if exists militar_sexo_valido;
alter table militar add constraint militar_sexo_valido check (sexo is null or sexo in ('M', 'F'));

-- dia e mês andam juntos; o dia precisa existir no mês (29 de fevereiro vale: sem ano, não há como saber se o ano é bissexto)
alter table militar drop constraint if exists militar_nascimento_valido;
alter table militar add constraint militar_nascimento_valido check (
  (nascimento_dia is null and nascimento_mes is null)
  or (
    nascimento_dia is not null and nascimento_mes is not null
    and nascimento_mes between 1 and 12
    and nascimento_dia between 1 and case nascimento_mes when 2 then 29 when 4 then 30 when 6 then 30 when 9 then 30 when 11 then 30 else 31 end
  )
);

-- e-mail institucional: só do domínio do Corpo de Bombeiros (sem distinção de maiúsculas), único entre os militares, pode ficar vazio
alter table militar drop constraint if exists militar_email_institucional;
alter table militar add constraint militar_email_institucional check (email is null or email ~* '^[^@[:space:]]+@bombeiros[.]pe[.]gov[.]br$');
create unique index if not exists militar_email_unico on militar (lower(email));

alter table militar drop constraint if exists militar_comportamento_valido;
alter table militar add constraint militar_comportamento_valido check (comportamento is null or comportamento in ('Excepcional', 'Ótimo', 'Bom', 'Insuficiente', 'Mau'));

alter table afastamento
  add column if not exists motivo text,
  add column if not exists boletim text;
alter table afastamento drop constraint if exists afastamento_motivo_curto;
alter table afastamento add constraint afastamento_motivo_curto check (motivo is null or char_length(motivo) <= 200);
alter table afastamento drop constraint if exists afastamento_boletim_curto;
alter table afastamento add constraint afastamento_boletim_curto check (boletim is null or char_length(boletim) <= 60);

-- tipos novos no catálogo (LTS já existe), sem duplicar mesmo se o administrador já os criou à mão
insert into tipo_afastamento (nome)
select v.nome
  from (values ('Adido'), ('Agregado'), ('L.E'), ('DTS')) as v (nome)
 where not exists (select 1 from tipo_afastamento t where lower(t.nome) = lower(v.nome));
