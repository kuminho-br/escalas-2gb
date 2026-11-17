# Casos compartilhados

Cada `<funcao_>.json` guarda chamadas reais às regras do protótipo (entrada e resposta, ou a mensagem de erro). Eles são a referência do motor novo: `pacotes/dominio` precisa responder exatamente o mesmo para cada caso.

- `catalogo.json`: as funções do motor, por módulo.
- `pnpm casos:gravar`: roda os testes de `prototipo/testes` e regrava os casos. Rode depois de mudar uma regra no protótipo e confira o `git diff casos`.
- `pnpm casos:prototipo`: confere que o protótipo reproduz os casos gravados (faz parte do `pnpm test`).

Regra que só existe no sistema novo (como as remoções do escalante) não grava caso: ela é testada direto em `pacotes/dominio/test`.

Os dados são fictícios (matrículas 990…, `M000`…). Nenhum dado pessoal real entra aqui.
