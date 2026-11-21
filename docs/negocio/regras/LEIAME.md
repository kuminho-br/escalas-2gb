# Catálogo de regras de negócio (RN-XX)

Fonte: Catálogo de Regras de Negócio do claude.ai (rev. 160, 15/11/2026), colhido em 20/11/2026. Quem cuida: DOCUMENTAÇÃO.

| Arquivo | O que tem |
|---|---|
| [servicos-e-guarnicoes.md](servicos-e-guarnicoes.md) | Serviços, turnos, ativação de guarnições e ordem de alocação |
| [carga-expediente-choques.md](carga-expediente-choques.md) | Carga horária, saldos, expediente do Adm e choques |
| [cotas-voluntariado-permutas.md](cotas-voluntariado-permutas.md) | Cotas, montagem da escala, voluntariado, situações boas e ruins, permutas |
| [sistema-e-interface.md](sistema-e-interface.md) | Escopo, configurações, interface e requisitos RS-XX |
| [normativo-a-validar.md](normativo-a-validar.md) | Regras do normativo (a validar) e pendências P-XX |

Este catálogo é a referência única das regras de negócio do sistema de escalas: cada regra tem um ID fixo (RN-XX), um status e a barreira a que pertence. O que o sistema precisa oferecer para dar conta dessas regras está na seção Requisitos do sistema, com IDs RS-XX.

## Como usar
O ID nunca é reaproveitado: regra descartada sai do catálogo e seu ID não volta a ser usado (ex.: RN-06, que virou registro da aba TURNOS). O código deve citar o ID da regra que implementa.

| Status | Significado |
|---|---|
| Confirmada | Regra validada, já pode ser implementada |
| A esclarecer | Falta informação ou há divergência a resolver |
| Implementada | Já funciona no sistema |


O andamento do trabalho (planejada, em implementação, em espera) é controle do PLANEJAMENTO e do SECRETARIADO, não deste catálogo: aqui o status só diz se a regra está esclarecida, validada ou já funciona.

## Barreiras de implementação
O sistema avança em duas frentes, aceleradas à medida que o processo é entendido.

| Barreira | O que mede | Meta |
|---|---|---|
| Barreira de suporte | Até onde o sistema ajuda o escalante a não errar (validações, alertas, ferramentas) | Cobrir todo o processo que está sendo descoberto |
| Barreira de automação | Até onde o sistema faz as coisas sozinho, ao receber as entradas corretas | Alcançar a barreira de suporte |


Cada regra tem uma coluna Barreira, que diz em qual frente do sistema a regra trabalha. Ela serve ao PLANEJAMENTO e à PROGRAMAÇÃO para ordenar o trabalho: primeiro o que é Base, depois Suporte, depois Automação. Valores:

| Valor | Significado |
|---|---|
| Base | Cadastro, modelo de dados ou configuração que sustenta as duas barreiras; vem primeiro |
| Suporte | Validação, alerta ou ferramenta para o escalante |
| Automação | O sistema executa sozinho |
| Ambas | O sistema valida o lançamento manual e também respeita a regra ao automatizar |


## Metas do sistema
Todo o sistema serve a duas metas; cada regra do catálogo existe para atingir uma delas ou as duas.

| ID | Regra | Status | Barreira |
|---|---|---|---|
| RN-49 | Meta 1: ativar as guarnições que foram definidas para serem ativadas (RN-07 a RN-12). | Confirmada | Ambas |
| RN-50 | Meta 2: escalar as cotas enviadas pela diretoria, internas e externas (RN-33 e RN-34). | Confirmada | Ambas |
| RN-51 | Para cada cota, o sistema mostra quanto foi recebido, distribuído e quanto resta, e a quantidade por militar, como faz hoje a planilha de cotas. | Confirmada | Suporte |


As regras de automação nunca impedem o escalante de fechar a escala: onde a automação para, o escalante decide manualmente com o apoio do sistema.
