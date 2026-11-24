#!/usr/bin/env bash
# Decide se o Vercel faz o deploy (6.41). É o `ignoreCommand` do vercel.json: sai com 0 para PULAR o deploy e com 1 para FAZÊ-LO.
# Prévia de PR (VERCEL_ENV=preview): sempre pula (6.43). Em produção: pula só quando todo arquivo mudado desde o último deploy (VERCEL_GIT_PREVIOUS_SHA) é documento: `docs/**` ou qualquer `*.md` (CLAUDE.md e os LEIAME incluídos).
# Na dúvida, deploy: sem a referência do deploy anterior, com uma referência que o clone não tem, sem nenhum arquivo na lista ou com qualquer erro do git.
# `--no-renames`: um arquivo renomeado aparece como removido (o caminho antigo) e criado (o novo), então renomear código para .md continua sendo código.

# 6.43: só a main faz deploy. A prévia de um PR (VERCEL_ENV=preview) é sempre pulada, qualquer que seja a mudança: ninguém a usa (a VALIDAÇÃO testa no
# site de teste) e o CI já confere o `pnpm build:vercel` em todo PR. Só o valor exato "preview" pula: produção, variável ausente ou outro valor seguem a regra abaixo.
if [ "${VERCEL_ENV:-}" = "preview" ]; then
  echo "Prévia de PR: o deploy é pulado (só a main faz deploy)."
  exit 0
fi

anterior="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$anterior" ]; then
  echo "Sem a referência do deploy anterior: deploy."
  exit 1
fi

if ! arquivos="$(git diff --no-renames --name-only "$anterior" HEAD 2>/dev/null)"; then
  echo "Não deu para comparar com $anterior: deploy."
  exit 1
fi

if [ -z "$arquivos" ]; then
  echo "Nenhum arquivo na lista: deploy."
  exit 1
fi

while IFS= read -r arquivo; do
  case "$arquivo" in
    docs/* | *.md) ;;
    *)
      echo "Mudou código ($arquivo): deploy."
      exit 1
      ;;
  esac
done <<< "$arquivos"

echo "Só documentação mudou: o deploy é pulado."
exit 0
