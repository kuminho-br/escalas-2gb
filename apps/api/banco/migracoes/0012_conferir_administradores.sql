-- Revisão 3: o gatilho da 0009 ("administrador só na raiz") vale para gravações novas e não olha o que já estava gravado.
-- Esta migração confere o que existe e para, dizendo quantos, se houver administrador (ou convite de administrador) fora da raiz.

do $$
declare
  fora int;
begin
  select (select count(*) from papel_usuario p join unidade u on u.id = p.unidade_id where p.papel = 'administrador' and u.mae_id is not null)
       + (select count(*) from convite c join unidade u on u.id = c.unidade_id where c.papel = 'administrador' and u.mae_id is not null)
    into fora;
  if fora > 0 then
    raise exception 'Há administrador fora da unidade raiz (% no total): troque o papel ou a unidade antes de migrar.', fora;
  end if;
end $$;
