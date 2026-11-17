## Resumo


## Migração
- [ ] Este PR **não** tem migração nova (`apps/api/banco/migracoes/`).
- [ ] Este PR **tem** migração: depois do merge, rodar `pnpm --filter api db:migrar:teste` no ambiente de teste. Até lá, a API responde 503 com "banco desatualizado".

## Testes
- [ ] `pnpm test`
- [ ] `pnpm typecheck`
