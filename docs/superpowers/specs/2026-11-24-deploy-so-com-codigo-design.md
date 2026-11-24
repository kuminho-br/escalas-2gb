# Deploy só quando o código muda — design

24/11/2026 · decisão do usuário no mesmo dia (caminho 1 de duas opções) · entrega 6.41 · plano: `docs/superpowers/plans/2026-11-24-fase6-41-deploy-so-com-codigo.md`

## Por quê

O site de teste roda no plano gratuito do Vercel, que aceita 100 deploys por dia. Em 24/11/2026, os PRs de documentos gastaram deploys à toa, e o limite foi atingido antes da 6.40: ela foi mesclada, mas não saiu no ar, e a migração 0043 ficou esperando. Documentação não muda o site, então o deploy desses PRs não traz nada.

## Decisão do usuário (24/11/2026)

- **Caminho 1:** pular o deploy quando o PR só mexe em documentos.
- **Não** mexer no plano pago do Vercel (custo é decisão do usuário).

## Escolhas da PLANEJAMENTO

- **Mecanismo:** a chave `ignoreCommand` do `vercel.json` (arquivo do repositório, revisado em PR). Ela roda um script que compara os arquivos alterados desde o último deploy (`VERCEL_GIT_PREVIOUS_SHA`) e decide se o build vale. Não se muda nenhuma configuração do projeto no painel do Vercel.
- **O que é só documento:** `docs/**`, `**/*.md` (inclui `CLAUDE.md` e os `README`), e `docs/telas/**`. Qualquer outro caminho (código, `casos/`, `prototipo/`, `scripts/`, `pacotes/`, `apps/`, `vercel.json`, pacotes e configurações) faz o deploy normal. Na dúvida, deploy.
- **Primeiro deploy ou sem referência:** sempre deploy.
- **Merge:** um PR só de documentos pode ser mesclado com `testes` verde e o Vercel em estado "ignorado" (ou o status que o GitHub der ao build pulado, que o primeiro PR de teste confirma). Um PR com código continua exigindo tudo verde, Vercel inclusive, como vale hoje.
- **Continua valendo:** o CI (`testes`) roda em todo PR, documentação inclusive. Não se pula teste.
- **Migração:** o cuidado de só migrar depois do deploy do commit mesclado não muda. Se o último commit de `main` for só documentação, o site já está com o código da entrega anterior, que é o mesmo.

## Não objetivos

- Mudar o plano ou o limite do Vercel.
- Pular testes em documentos.

## Anti-objetivos

- Pular o deploy de um PR que tenha código, mesmo que pequeno.
- Esconder uma falha do Vercel: o status "ignorado" só vale quando o motivo é esse script.

## Verificação do caminho

Antes de contar com o caminho, o primeiro PR só de documentos depois do script mostra no GitHub o status do Vercel. Se o status vier como falha (e não como ignorado), o caminho não funciona e volta à decisão do usuário.
