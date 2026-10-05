import { describe, expect, it, vi } from 'vitest'
import { createLibraryClient, LIST_LIMIT } from './libraryClient'

function fakeFetcher() {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => [] }) as unknown as Response)
}

describe('libraryClient', () => {
  it('asks the API for the whole page it is allowed to read', async () => {
    // Arrange
    const fetcher = fakeFetcher()
    const client = createLibraryClient(fetcher)

    // Act
    await client.getTitles('', 'token')
    await client.getOpenLoans('token')

    // Assert: the default limits would silently hide part of the catalogue.
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/titles?limit=${LIST_LIMIT}`), expect.anything())
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/open-loans?limit=${LIST_LIMIT}`), expect.anything())
  })

  it('looks a copy up by the barcode it scans', async () => {
    // Arrange
    const fetcher = fakeFetcher()
    const client = createLibraryClient(fetcher)

    // Act
    await client.copyOfBarcode('BC 0001', 'token')

    // Assert
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/copies/by-barcode/BC%200001'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token' }) }),
    )
  })

  it('sends the institutional reference and no date when a loan is returned', async () => {
    // Arrange
    const fetcher = fakeFetcher()
    const client = createLibraryClient(fetcher)

    // Act
    await client.returnLoan('loan-1', 'Devolución 1 de 2026', 'token')

    // Assert: the server stamps the return with its own institutional clock.
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/loans/loan-1/return'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ sourceReference: 'Devolución 1 de 2026' }) }),
    )
  })
})
