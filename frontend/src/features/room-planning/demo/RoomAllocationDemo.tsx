import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { createRoomAllocationClient, RoomAllocationApiError } from './roomAllocationClient'
import type { RoomAllocationClient } from './roomAllocationClient'
import type { RoomAllocationProposal } from './roomAllocationContracts'
import { roomPlanningSampleScenarios } from './sampleRoomScenarios'
import './RoomAllocationDemo.scss'

export interface RoomAllocationDemoSession {
  type: 'local-preview'
  accessToken: string
}

interface RoomAllocationDemoProps {
  session: RoomAllocationDemoSession | null
  client?: Pick<RoomAllocationClient, 'propose'>
}

type RequestState = 'idle' | 'loading' | 'ready' | 'error'

const defaultClient = createRoomAllocationClient()

export function RoomAllocationDemo({ session, client = defaultClient }: RoomAllocationDemoProps) {
  const sessionKey = session?.type === 'local-preview' ? 'preview-open' : 'preview-closed'
  return <RoomAllocationDemoContent key={sessionKey} session={session} client={client} />
}

function RoomAllocationDemoContent({ session, client }: Required<RoomAllocationDemoProps>) {
  const [scenarioId, setScenarioId] = useState(roomPlanningSampleScenarios[0]!.id)
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [proposal, setProposal] = useState<RoomAllocationProposal | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const requestControllerRef = useRef<AbortController | null>(null)
  const selectedSample = roomPlanningSampleScenarios.find(({ id }) => id === scenarioId)
    ?? roomPlanningSampleScenarios[0]!
  const canPropose = session?.type === 'local-preview' && Boolean(session.accessToken.trim())

  useEffect(() => () => {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
  }, [])

  async function submitProposal(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault()
    if (!canPropose || !session || !selectedSample) return

    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    setProposal(null)
    setErrorMessage(null)
    setRequestState('loading')

    try {
      const nextProposal = await client.propose(selectedSample.scenario, session.accessToken, controller.signal)
      if (controller.signal.aborted) return
      setProposal(nextProposal)
      setRequestState('ready')
    } catch (error) {
      if (controller.signal.aborted) return
      setErrorMessage(error instanceof RoomAllocationApiError
        ? error.message
        : 'No fue posible consultar el servicio de preview. Revisa la conexión e inténtalo de nuevo.')
      setRequestState('error')
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null
    }
  }

  function changeScenario(value: string) {
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setScenarioId(value)
    setProposal(null)
    setErrorMessage(null)
    setRequestState('idle')
  }

  return (
    <section className="room-allocation-demo" aria-labelledby="room-allocation-title">
      <header className="room-allocation-hero">
        <div className="room-allocation-hero-copy">
          <p className="room-allocation-eyebrow"><span aria-hidden="true">✳</span> LABORATORIO DE DESARROLLO</p>
          <h1 id="room-allocation-title">Asignación de aulas <span>· demo</span></h1>
          <p>Explora cómo capacidad, equipamiento y cruces de horario afectan una propuesta académica.</p>
        </div>
        <div className="room-allocation-hero-mark" aria-hidden="true"><span>R</span><i /><i /><i /></div>
      </header>

      <div className="room-allocation-synthetic-note" role="note">
        <strong>Escenarios totalmente sintéticos</strong>
        <span>Esta demostración no consulta salones, cursos, docentes, horarios ni matrículas de la UPTC. No reserva aulas ni guarda cambios.</span>
      </div>

      <div className="room-allocation-layout">
        <section className="room-allocation-controls" aria-label="Escenario de prueba">
          <div className="room-allocation-section-heading">
            <span className="room-allocation-step">01</span>
            <div><h2>Prepara el escenario</h2><p>Elige una muestra incluida en la aplicación.</p></div>
          </div>

          <form onSubmit={(event) => void submitProposal(event)}>
            <label className="room-allocation-field" htmlFor="room-allocation-scenario">
              <span>Escenario sintético</span>
              <select
                id="room-allocation-scenario"
                value={scenarioId}
                disabled={requestState === 'loading'}
                onChange={(event) => changeScenario(event.currentTarget.value)}
              >
                {roomPlanningSampleScenarios.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
              </select>
              <small>{selectedSample.description}</small>
            </label>

            <div className="room-allocation-input-summary" aria-label="Tamaño del escenario">
              <div><strong>{selectedSample.scenario.groups.length}</strong><span>grupos</span></div>
              <div><strong>{selectedSample.scenario.rooms.length}</strong><span>aulas de muestra</span></div>
              <div><strong>{selectedSample.scenario.groups.reduce((total, group) => total + group.meetings.length, 0)}</strong><span>bloques semanales</span></div>
            </div>

            {!canPropose && <p className="room-allocation-session-needed" role="status">
              Inicia el preview local desde la barra superior para ejecutar el cálculo. El acceso no es institucional.
            </p>}

            <button className="room-allocation-submit" type="submit" disabled={!canPropose || requestState === 'loading'}>
              <span aria-hidden="true">{requestState === 'loading' ? '◌' : '↗'}</span>
              {requestState === 'loading' ? 'Calculando propuesta…' : requestState === 'error' ? 'Reintentar cálculo' : 'Calcular propuesta'}
            </button>
          </form>

          <div className="room-allocation-criteria">
            <p>El motor prioriza</p>
            <ul>
              <li><span>1</span>Asignar el mayor número de grupos</li>
              <li><span>2</span>Reducir los puestos sin usar</li>
              <li><span>3</span>Evitar cruces en una misma aula</li>
            </ul>
          </div>
        </section>

        <section className="room-allocation-results" aria-labelledby="room-allocation-results-title" aria-live="polite">
          <div className="room-allocation-section-heading">
            <span className="room-allocation-step">02</span>
            <div><h2 id="room-allocation-results-title">Propuesta de distribución</h2><p>El resultado es temporal y desaparece al salir.</p></div>
          </div>

          {requestState === 'idle' && <div className="room-allocation-empty-state">
            <span aria-hidden="true">⌖</span>
            <strong>El aula correcta empieza con un buen encaje.</strong>
            <p>Calcula el escenario seleccionado para revisar compatibilidad y conflictos.</p>
          </div>}

          {requestState === 'loading' && <p className="room-allocation-loading" role="status">
            <span aria-hidden="true">◌</span>Comparando horarios, aforo y recursos…
          </p>}

          {requestState === 'error' && <div className="room-allocation-error" role="alert">
            <strong>No se obtuvo una propuesta</strong>
            <p>{errorMessage}</p>
          </div>}

          {requestState === 'ready' && proposal && <>
            <div className="room-allocation-result-summary">
              <strong>{proposal.assignedGroups} de {proposal.placements.length} grupos asignados</strong>
              <span>{proposal.unassignedGroups === 0
                ? 'Todos los grupos tienen una opción compatible en esta muestra.'
                : `${proposal.unassignedGroups} grupo${proposal.unassignedGroups === 1 ? '' : 's'} queda${proposal.unassignedGroups === 1 ? '' : 'n'} sin aula.`}</span>
            </div>
            <div className="room-allocation-metrics" aria-label="Resumen de la propuesta">
              <div><strong>{proposal.assignedGroups}</strong><span>asignados</span></div>
              <div><strong>{proposal.unassignedGroups}</strong><span>sin aula</span></div>
              <div><strong>{proposal.unusedSeats}</strong><span>puestos libres</span></div>
            </div>
            {proposal.placements.length === 0
              ? <p className="room-allocation-empty-state">Este escenario no contiene grupos para ubicar.</p>
              : <ol className="room-allocation-placement-list" aria-label="Resultado de asignación">
                {proposal.placements.map((placement) => <li key={placement.groupCode}>
                  <span className={`room-allocation-status ${placement.status === 'ASSIGNED' ? 'is-assigned' : 'is-unassigned'}`} aria-hidden="true">
                    {placement.status === 'ASSIGNED' ? '✓' : '!'}</span>
                  <div className="room-allocation-placement-copy">
                    <strong>{placement.groupCode}</strong>
                    {placement.status === 'ASSIGNED'
                      ? <span>{placement.roomCode} <i>·</i> {placement.remainingSeats} puestos libres</span>
                      : <span>{reasonLabel(placement.reason)}</span>}
                  </div>
                  <span className="room-allocation-placement-tag">{placement.status === 'ASSIGNED' ? 'Aula asignada' : 'Pendiente'}</span>
                </li>)}
              </ol>}
            <p className="room-allocation-result-footnote">Propuesta de demostración; no representa una decisión ni disponibilidad oficial.</p>
          </>}
        </section>
      </div>
    </section>
  )
}

function reasonLabel(reason: RoomAllocationProposal['placements'][number]['reason']): string {
  switch (reason) {
    case 'NO_ACTIVE_ROOMS': return 'No hay aulas activas en este escenario.'
    case 'INSUFFICIENT_CAPACITY': return 'Aforo insuficiente para el grupo.'
    case 'MISSING_REQUIRED_FEATURES': return 'Falta equipamiento requerido.'
    case 'TIME_CONFLICT': return 'Conflicto de horario con las aulas disponibles.'
    default: return 'Sin aula compatible en el escenario.'
  }
}
