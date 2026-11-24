import type { ComponentProps } from 'react';
import { Input } from '@/componentes/ui/input';
import { DOMINIO_DO_EMAIL, mascararTelefone, usuarioDoEmail } from '@/lib/mascaras';

type PropsDoInput = Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>;

/** O telefone: a pessoa digita só números e o campo mostra "(81) 99668-1232" (11 dígitos) ou "(81) 3333-4444" (10). */
export function CampoDeTelefone({ valor, aoMudar, ...resto }: PropsDoInput & { valor: string; aoMudar: (v: string) => void }) {
  return <Input type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="(81) 99999-9999" {...resto} value={valor} onChange={(e) => aoMudar(mascararTelefone(e.target.value))} />;
}

/**
 * O e-mail institucional: o campo recebe só o usuário, e o domínio fica fixo à direita, dentro do campo. Colar um e-mail inteiro do domínio fica só com o usuário; de outro domínio,
 * `aoMudar` recebe o texto como está e a frase de erro. O domínio é para o olho (`aria-hidden`); o leitor de tela o ouve na descrição do campo.
 */
export function CampoDeEmailInstitucional({ valor, aoMudar, id, ...resto }: PropsDoInput & { id: string; valor: string; aoMudar: (usuario: string, erro: string | null) => void }) {
  const descreve = [resto['aria-describedby'], `${id}-dominio`].filter(Boolean).join(' ');
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="nome.sobrenome"
        {...resto}
        id={id}
        aria-describedby={descreve}
        className="pr-[11.5rem]"
        value={valor}
        onChange={(e) => {
          const { usuario, erro } = usuarioDoEmail(e.target.value);
          aoMudar(usuario, erro);
        }}
      />
      <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-apagado">{DOMINIO_DO_EMAIL}</span>
      <span id={`${id}-dominio`} className="sr-only">no domínio {DOMINIO_DO_EMAIL}</span>
    </div>
  );
}
