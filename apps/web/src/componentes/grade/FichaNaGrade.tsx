import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mensagemDe } from '@/api/cliente';
import type { Eu } from '@/api/eu';
import { consultaFicha } from '@/api/militares';
import { FichaCompleta } from '@/componentes/militares/FichaCompleta';
import { Espera } from '@/componentes/resposta/Espera';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/componentes/ui/dialog';

/**
 * A ficha do militar na escala (a mesma de `/militares/$id`, 6.32) numa janela por cima da Grade geral (6.65): a Grade fica onde está (a seleção, a rolagem e o painel do dia
 * continuam), e fechar a janela devolve o foco ao militar que a abriu. A ficha enxuta: Dados pessoais e Comportamento são da ficha completa do Pecúlio.
 */
export function FichaNaGrade({ militarId, eu, aoFechar }: { militarId: string; eu: Eu; aoFechar: () => void }) {
  const { data: ficha, error, isPending } = useQuery(consultaFicha(militarId));
  const queryClient = useQueryClient();
  // a ficha edita equipe, jornada e afastamentos: ao fechar, a Grade busca de novo para mostrar o que mudou
  const fechar = () => {
    void queryClient.invalidateQueries({ queryKey: ['grade'] });
    aoFechar();
  };
  return (
    <Dialog open onOpenChange={(aberta) => !aberta && fechar()}>
      {/* sem gatilho, o Radix não devolve o foco: ele volta ao militar que abriu a ficha */}
      <DialogContent
        className="max-h-[90dvh] max-w-3xl gap-0 overflow-y-auto p-0 sm:max-w-3xl"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>(`tr[data-militar="${militarId}"] [data-abrir-ficha]`)?.focus();
        }}
      >
        <DialogTitle className="sr-only">Ficha do militar</DialogTitle>
        <DialogDescription className="sr-only">A ficha do militar na escala. Esc fecha a janela.</DialogDescription>
        {isPending && <Espera className="p-4" />}
        {error && <p role="alert" className="p-4 text-alerta">{mensagemDe(error)}</p>}
        {ficha && <FichaCompleta ficha={ficha} eu={eu} completa={false} voltarPara="/grade" semVoltar />}
      </DialogContent>
    </Dialog>
  );
}
