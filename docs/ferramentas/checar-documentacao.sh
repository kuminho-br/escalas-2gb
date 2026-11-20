#!/usr/bin/env bash
# Checagem da documentação (régua em docs/LEIAME.md). Roda da raiz do repositório e imprime o relatório em Markdown.
# Uso: bash docs/ferramentas/checar-documentacao.sh > docs/relatorio-documentacao.md
set -u
cd "$(git rev-parse --show-toplevel)"
LIM_KB=25; CRIT_KB=50; LIM_PAR=400; LIM_ADENDOS=3; LIM_CLAUDE=120
mds=$( { git ls-files -co --exclude-standard 'docs/*.md' 'docs/**/*.md' '*.md' | sort -u; } | grep -v '^pr_' )
claude_falhas=0
cont=$(mktemp)
alerta() { echo x >> "$cont"; echo "- $*"; }

echo "# Relatório da documentação"
echo
echo "Gerado em $(date +%Y-%m-%d) pelo script \`docs/ferramentas/checar-documentacao.sh\` sobre o commit \`$(git rev-parse --short HEAD)\`."
echo

secao() { echo; echo "## $1"; echo; }
corpo=$(mktemp)

# 1. Tamanho
{
secao "Documentos grandes (acima de ${LIM_KB} KB)"
achou=0
for f in $mds; do
  b=$(wc -c < "$f"); kb=$((b/1024))
  if [ "$b" -gt $((CRIT_KB*1024)) ]; then alerta "**crítico** \`$f\`: ${kb} KB"; achou=1
  elif [ "$b" -gt $((LIM_KB*1024)) ]; then alerta "\`$f\`: ${kb} KB"; achou=1; fi
done
[ $achou = 0 ] && echo "Nenhum."
} >> "$corpo"

# 2. Parágrafos longos (fora de tabela e de bloco de código)
{
secao "Parágrafos com mais de ${LIM_PAR} caracteres"
n=$(for f in $mds; do awk -v L=$LIM_PAR -v F="$f" '/^```/{c=!c;next} !c && !/^\|/ && length($0)>L {n++} END{if(n>0) print n"\t"F}' "$f"; done | sort -rn)
if [ -z "$n" ]; then echo "Nenhum."; else echo "$n" | while IFS=$'\t' read q f; do alerta "\`$f\`: $q"; done; fi
} >> "$corpo"

# 3. Adendos
{
secao "Documentos com mais de ${LIM_ADENDOS} adendos"
achou=0
for f in $mds; do
  q=$(grep -ciE '^#{1,4} adendo' "$f"); [ "$q" -gt $LIM_ADENDOS ] && { alerta "\`$f\`: $q adendos (consolidar)"; achou=1; }
done
[ $achou = 0 ] && echo "Nenhum."
} >> "$corpo"

# 4. CLAUDE.md
{
secao "CLAUDE.md"
linhas=$(wc -l < CLAUDE.md); echo "- Linhas: $linhas (limite $LIM_CLAUDE)"
[ "$linhas" -gt $LIM_CLAUDE ] && claude_falhas=$((claude_falhas+1))
if grep -nE 'Estado atual|[0-9]+ ok\b' CLAUDE.md >/dev/null; then echo "- Tem \"estado atual\" ou contagem de testes: $(grep -cE 'Estado atual|[0-9]+ ok\b' CLAUDE.md) linha(s)"; claude_falhas=$((claude_falhas+1)); else echo "- Sem \"estado atual\" nem contagem de testes."; fi
quebrados=$(grep -ohE '`(apps|pacotes|docs|prototipo|casos|scripts)/[^` ]*`' CLAUDE.md prototipo/CLAUDE.md | tr -d '`' | sort -u | while read p; do [ -e "$p" ] || echo "$p"; done)
if [ -n "$quebrados" ]; then echo "- Caminhos que não existem:"; echo "$quebrados" | sed 's/^/  - `/;s/$/`/'; claude_falhas=$((claude_falhas+1)); else echo "- Todos os caminhos citados existem."; fi
if [ $claude_falhas -eq 0 ]; then nota="bom"; elif [ $claude_falhas -eq 1 ]; then nota="regular"; else nota="insatisfatório"; fi
echo "- **Nota: $nota**"
[ $claude_falhas -gt 0 ] && for _ in $(seq $claude_falhas); do echo x >> "$cont"; done
} >> "$corpo"

# 5. ER x migrações
{
secao "Esquema do banco × migrações"
f=docs/superpowers/specs/2026-11-16-esquema-banco.md
falta=$(grep -hoiE 'create table (if not exists )?[a-z_."]+' apps/api/banco/migracoes/*.sql | awk '{print $NF}' | tr -d '"' | sed 's/.*\.//' | sort -u | while read t; do grep -qE "^### .*\b$t\b" "$f" || echo "$t"; done)
ult=$(ls apps/api/banco/migracoes | tail -1)
echo "Última migração: \`$ult\`."
if [ -z "$falta" ]; then echo "Toda tabela tem título no esquema."; else echo "$falta" | while read t; do alerta "tabela sem título no esquema: \`$t\`"; done; fi
grep -q "$(echo "$ult" | sed 's/\.sql//')" "$f" || alerta "o esquema não cita a última migração (\`$ult\`)"
} >> "$corpo"

# 6. Índice x arquivos e links
{
secao "Índice"
achou=0
for f in $(git ls-files -co --exclude-standard 'docs/*.md' 'docs/*.html' 'docs/**/*.md' 'docs/**/*.html'); do
  rel=${f#docs/}; [ "$rel" = LEIAME.md ] && continue
  if ! grep -qF "$rel" docs/LEIAME.md; then
    d=$(dirname "$f"); { [ -f "$d/LEIAME.md" ] && [ "$d" != docs ]; } || { alerta "fora do índice: \`$f\`"; achou=1; }
  fi
done
grep -oE '\]\([^)#]+' docs/LEIAME.md | sed 's/^](//' | grep -v '^http' | while read p; do [ -e "docs/$p" ] || echo "quebrado: $p"; done > "$corpo.q"
if [ -s "$corpo.q" ]; then achou=1; while read l; do alerta "link $l"; done < "$corpo.q"; fi
[ $achou = 0 ] && echo "Todos os documentos estão no índice e os links funcionam."
rm -f "$corpo.q"
} >> "$corpo"

# 7. Branches de documentação paradas
{
secao "Branches \`docs-*\` e \`documentacao-*\` não mescladas"
git fetch origin -q 2>/dev/null
achou=0
for b in $(git for-each-ref --format='%(refname:short)' 'refs/remotes/origin/docs-*' 'refs/remotes/origin/documentacao-*'); do
  git merge-base --is-ancestor "$b" origin/main 2>/dev/null && continue
  dias=$(( ( $(date +%s) - $(git log -1 --format=%ct "$b") ) / 86400 ))
  alerta "\`${b#origin/}\`: sem merge, último commit há $dias dia(s)"; achou=1
done
[ $achou = 0 ] && echo "Nenhuma."
} >> "$corpo"

alertas=$(wc -l < "$cont" | tr -d " "); echo "**Resumo:** $alertas alerta(s). CLAUDE.md: $(grep -o 'Nota: [a-zç]*' "$corpo" | head -1 | sed 's/Nota: //')."
cat "$corpo"; rm -f "$corpo" "$cont"
