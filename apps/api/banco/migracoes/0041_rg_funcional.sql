-- 6.36: o RG funcional do militar (registro geral nos órgãos estaduais de segurança pública), nos dados pessoais.
-- Opcional; quando preenchido é único (índice parcial). A auditoria da tabela militar já cobre a coluna nova.
alter table militar add column if not exists rg_funcional text;
alter table militar drop constraint if exists militar_rg_funcional_formato;
alter table militar add constraint militar_rg_funcional_formato check (rg_funcional is null or rg_funcional ~ '^[A-Za-z0-9.-]{1,20}$');
create unique index if not exists militar_rg_funcional_unico on militar (rg_funcional) where rg_funcional is not null;
