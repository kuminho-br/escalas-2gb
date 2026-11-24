-- 6.37: choque universal. O serviço ganha a opção "Pode tirar o militar do Adm do expediente" (ligada no Saldo, desligada nos demais), e o
-- parâmetro "Adm cumpre a carga mensal" sai: o choque de horário vale para todos, sem configuração.
alter table servico add column if not exists tira_do_expediente boolean not null default false;
update servico set tira_do_expediente = true where lower(btrim(nome)) = 'saldo';

-- todo Saldo que nascer daqui em diante (outra seção, importação) já vem com a opção ligada; depois dá para desligar pelo cadastro
create or replace function servico_fixo() returns trigger language plpgsql as $$
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
  if tg_op = 'INSERT' and lower(btrim(new.nome)) = 'saldo' then new.tira_do_expediente := true; end if;
  return new;
end $$;

-- o parâmetro que deixava o Adm chocar com o expediente não é lido por nada: os valores gravados saem
delete from parametro where chave = 'ADM_CUMPRE_CARGA';
