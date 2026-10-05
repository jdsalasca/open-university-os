import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdmissionsExperience } from './AdmissionsExperience'
import type { AdmissionsCallClient } from './admissionsCallContracts'

afterEach(cleanup)

function publicCalendarClient(): AdmissionsCallClient {
  return {
    getPublicCalls: vi.fn(async () => []),
    getAdminCalls: vi.fn(async () => []),
    createCall: vi.fn(async () => { throw new Error('Unexpected call creation') }),
    createRevision: vi.fn(async () => { throw new Error('Unexpected revision creation') }),
    updateDraft: vi.fn(async () => { throw new Error('Unexpected draft update') }),
    publish: vi.fn(async () => { throw new Error('Unexpected publication') }),
  }
}

describe('AdmissionsExperience in a local Vite build', () => {
  it('shows the public calendar without applicant or operator demo routes', async () => {
    // Arrange
    const client = publicCalendarClient()
    render(<AdmissionsExperience client={client} />)

    // Act
    const calendar = await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })

    // Assert
    expect(calendar).toBeVisible()
    expect(screen.getByText(/no hay una convocatoria administrada publicada/i)).toBeVisible()
    expect(screen.queryByRole('tab', { name: /aspirante|equipo de admisiones/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/ficha demo-|datos ficticios|solicitar ajuste demo/i)).not.toBeInTheDocument()
    expect(client.getPublicCalls).toHaveBeenCalledOnce()
    expect(client.getAdminCalls).not.toHaveBeenCalled()
    expect(client.createCall).not.toHaveBeenCalled()
  })

  it('keeps the public reference calendar when the published-call API fails', async () => {
    // Arrange
    const client = publicCalendarClient()
    client.getPublicCalls = vi.fn(async () => { throw new Error('network unavailable') })
    render(<AdmissionsExperience client={client} />)

    // Act
    const calendar = await screen.findByRole('heading', { name: /pregrado presencial.*2027-i/i })

    // Assert
    expect(calendar).toBeVisible()
    expect(screen.getByText(/no fue posible consultar la agenda versionada/i)).toBeVisible()
    expect(screen.queryByRole('tab', { name: /aspirante|equipo de admisiones/i })).not.toBeInTheDocument()
    expect(client.getPublicCalls).toHaveBeenCalledOnce()
  })
})
