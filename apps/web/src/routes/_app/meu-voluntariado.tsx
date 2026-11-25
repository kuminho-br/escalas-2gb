import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Mes, mesPorExtenso } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaMeuVoluntariado, salvarMeuVoluntariado } from '@/api/meu-voluntariado';
import { ProvedorDePendencias } from '@/componentes/AlteracoesPendentes';
import { CampoDeMes } from '@/componentes/CampoDeMes';
import { Moldura } from '@/componentes/Moldura';
import { Espera } from '@/componentes/resposta/Espera';
import { Label } from '@/componentes/ui/label';
import { CalendarioDoVoluntariado } from '@/componentes/voluntariado/CalendarioDoVoluntariado';
import { guiaJaFechado, lembrarGuiaFechado } from '@/componentes/voluntariado/GuiaComoMarcar';
import { mesAtual } from '@/lib/meses';

export const Route = createFileRoute('/_app/meu-voluntariado')({
  validateSearch: (s: Record<string, unknown>): { mes?: string } => ({ mes: typeof s.mes === 'string' && Mes.safeParse(s.mes).success ? s.mes : undefined }),
  component: MeuVoluntariadoDaConta,
});

const AVISO_JES = 'Você não tem o atributo de voluntário JES: o que marcar vale para diárias. Para JES e PJES, fale com quem cuida do seu cadastro.';

/** O militar marca o próprio voluntariado: o mesmo calendário do escalante, sobre o mês da própria conta. Abre no primeiro mês com a coleta aberta. */
function MeuVoluntariadoDaConta() {
  const { eu } = Route.useRouteContext();
  const busca = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const mes = busca.mes ?? eu.coletasAbertas?.[0] ?? mesAtual();
  const dados = useQuery(consultaMeuVoluntariado(mes));
  const [salvo, setSalvo] = useState<string | null>(null);
  const [guiaAberto, setGuiaAberto] = useState(() => !guiaJaFechado());

  return (
    <ProvedorDePendencias>
      <Moldura titulo="Meu voluntariado">
        <div className="grid gap-1.5">
          <Label htmlFor="mv-mes">Mês</Label>
          <CampoDeMes
            id="mv-mes"
            valor={mes}
            aoMudar={(m) => {
              setSalvo(null);
              void navigate({ search: { mes: m } });
            }}
          />
        </div>
        {dados.isPending && <Espera />}
        {dados.error && <p role="alert" className="text-alerta">{mensagemDe(dados.error)}</p>}
        {dados.data && (
          <div className="grid gap-3">
            <p className="text-sm text-apagado">
              {dados.data.podeMarcar
                ? `A coleta de ${mesPorExtenso(mes)} está aberta. Marque os dias e horários em que você aceita tirar serviço extra.`
                : dados.data.motivo}
            </p>
            <CalendarioDoVoluntariado
              key={mes}
              proprio
              militar={{ posto: eu.militar.postoGrad, nomeGuerra: eu.militar.nomeGuerra, equipe: null, jornada: 'pronto', voluntarioJes: dados.data.voluntarioJes }}
              avisoDoCabecalho={
                <>
                  <span>{`${dados.data.unidadeSigla}.`}</span>
                  {!dados.data.voluntarioJes && <span>{` ${AVISO_JES}`}</span>}
                </>
              }
              mes={mes}
              dados={dados.data}
              soLeitura={!dados.data.podeMarcar}
              guiaAberto={guiaAberto}
              aoAbrirGuia={() => setGuiaAberto(true)}
              aoFecharGuia={() => {
                setGuiaAberto(false);
                lembrarGuiaFechado();
              }}
              aoSalvar={async (faixas, soltarPendencia) => {
                setSalvo(null);
                await salvarMeuVoluntariado(queryClient, mes, faixas);
                soltarPendencia();
                setSalvo(`Voluntariado de ${mesPorExtenso(mes)} salvo.`);
              }}
            />
            {salvo && <p role="status" className="text-sm text-apagado">{salvo}</p>}
          </div>
        )}
      </Moldura>
    </ProvedorDePendencias>
  );
}
