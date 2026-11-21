-- Fase 6, entrega 1: contas e papéis. A senha provisória tem prazo (uma coluna no usuário), o e-mail de entrada é o da ficha do militar
-- (um gatilho mantém os dois iguais) e o convite, que nunca teve uso, sai.
-- Pode rodar de novo: coluna com "if not exists", função e gatilho recriados.

drop table if exists convite;

-- null = senha definitiva; com data, é a senha provisória e vale até ela
alter table usuario add column if not exists senha_provisoria_ate timestamptz;

-- o login é pelo e-mail da ficha: mudar o e-mail do militar muda o e-mail de entrada do usuário dele.
-- Quem tem acesso ativo não fica sem e-mail (a ficha pede para desativar o acesso antes). Só age quando o e-mail da ficha muda: editar outro
-- campo de quem tem usuário e ficha sem e-mail (o administrador criado na instalação) segue valendo.
create or replace function militar_email_para_usuario() returns trigger language plpgsql as $$
begin
  if new.email is null then
    if exists (select 1 from usuario where militar_id = new.id and ativo) then
      raise exception 'email_obrigatorio_com_acesso';
    end if;
    return null;
  end if;
  update usuario set email = lower(new.email), atualizado_em = now() where militar_id = new.id;
  return null;
end $$;

drop trigger if exists militar_email_para_usuario on militar;
create trigger militar_email_para_usuario after update of email on militar
  for each row when (old.email is distinct from new.email) execute function militar_email_para_usuario();
