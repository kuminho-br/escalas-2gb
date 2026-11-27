-- As ferramentas em teste e o retorno do Laboratório (6.60). As duas tabelas são do REAL: a lista é lida e o retorno gravado pelas rotas do real, com a conta real.
-- (As migrações valem para os dois schemas, então as tabelas existem também no espelho, vazias e sem uso.) Repor o espelho nunca apaga um retorno.
create table ferramenta_teste (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 80),
  o_que_testar text not null check (char_length(o_que_testar) between 1 and 500),
  -- onde a ferramenta está dentro do Laboratório (um caminho do site, que começa com /); sem ele, a ferramenta é só uma descrição
  caminho text check (caminho is null or (caminho like '/%' and char_length(caminho) <= 200)),
  situacao text not null default 'em_teste' check (situacao in ('em_teste', 'encerrada', 'virou_modulo')),
  inicio date not null default current_date,
  fim date,
  check (fim is null or fim >= inicio)
);

create table retorno_laboratorio (
  id uuid primary key default gen_random_uuid(),
  ferramenta_id uuid not null references ferramenta_teste (id),
  -- a conta REAL de quem deixou o retorno; o perfil de teste em uso é só um dado dele
  usuario_id uuid not null references usuario (id),
  perfil_de_teste text not null,
  tela text not null,
  texto text not null check (char_length(texto) between 1 and 2000),
  nota smallint not null check (nota between 1 and 5),
  criado_em timestamptz not null default now()
);
create index retorno_laboratorio_ferramenta on retorno_laboratorio (ferramenta_id, criado_em desc);

-- o retorno é imutável depois de enviado: nem editar, nem apagar
create function retorno_laboratorio_imutavel() returns trigger language plpgsql as $$
begin
  raise exception 'O retorno do Laboratório não se altera nem se apaga';
end $$;
create trigger retorno_laboratorio_sem_alteracao before update or delete on retorno_laboratorio for each row execute function retorno_laboratorio_imutavel();
create trigger retorno_laboratorio_sem_truncate before truncate on retorno_laboratorio for each statement execute function retorno_laboratorio_imutavel();

create trigger auditoria_registro after insert or update or delete on ferramenta_teste for each row execute function registrar_auditoria();
