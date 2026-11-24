import { Link, type LinkProps } from '@tanstack/react-router';
import { Button } from '@/componentes/ui/button';

/**
 * O vazio de uma tela: um só por tela. O título em 20 px, uma frase em `apagado` e o próximo passo num botão secundário (o principal continua no alto da tela).
 * `acao.para` leva a outra tela; `acao.aoClicar` faz algo aqui.
 */
export function Vazio({ titulo, frase, acao }: { titulo: string; frase: string; acao?: { rotulo: string; aoClicar?: () => void; para?: LinkProps['to'] } }) {
  return (
    <div data-vazio className="grid justify-items-start gap-2 py-6">
      <h2 className="font-cond text-bloco font-semibold">{titulo}</h2>
      <p className="text-corpo text-apagado">{frase}</p>
      {acao && (acao.para ? (
        <Button asChild variant="secundario">
          <Link to={acao.para}>{acao.rotulo}</Link>
        </Button>
      ) : (
        <Button type="button" variant="secundario" onClick={acao.aoClicar}>
          {acao.rotulo}
        </Button>
      ))}
    </div>
  );
}
