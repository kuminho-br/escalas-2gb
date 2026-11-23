-- Entrega 6.15 (diretriz do usuário, 23/11/2026): o posto aparece sem "BM" (SD, CB, 3º SGT, 2º TEN…). "BM" não é posto: só diz que a corporação é o
-- Bombeiro Militar, e o sistema é só de bombeiros. A migração tira o " BM" do fim da sigla de todo posto; a ordem, o nome e os quadros não mudam.
-- Pode rodar de novo: só mexe em sigla que ainda termina em " BM", e deixa como está a que ficaria igual a outra (a sigla é única).
-- A carga base (0007) e os quadros (0026) são história e continuam como foram escritos.
update posto_grad p
   set sigla = regexp_replace(p.sigla, ' BM$', '')
 where p.sigla ~ ' BM$'
   and not exists (select 1 from posto_grad o where o.sigla = regexp_replace(p.sigla, ' BM$', '') and o.id <> p.id);
