import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LibraryAdminPage } from './LibraryAdminPage'
import { LibraryApiError } from './libraryClient'
import type { LibraryClient } from './libraryClient'
import type { LibraryCopy, LibraryLoan, LibraryTitle } from './libraryContracts'

const TITLE: LibraryTitle = {
  titleId: 'title-1',
  title: 'Álgebra lineal',
  authors: ['Autor uno'],
  edition: '3a',
  publicationYear: 2019,
  sourceReference: 'Acta 1 de 2026',
}

const OVERDUE_LOAN: LibraryLoan = {
  loanId: 'loan-1',
  copyId: 'copy-1',
  borrowerUserId: 'user-1',
  lentOn: '2026-01-01',
  dueOn: '2026-02-01',
  returnedOn: null,
  overdue: true,
  sourceReference: 'Préstamo 1 de 2026',
}

const CURRENT_LOAN: LibraryLoan = {
  ...OVERDUE_LOAN,
  loanId: 'loan-2',
  copyId: 'copy-2',
  dueOn: '2099-01-01',
  overdue: false,
  sourceReference: 'Préstamo 2 de 2026',
}

const ACTIVE_COPY: LibraryCopy = {
  copyId: 'copy-1',
  titleId: 'title-1',
  barcode: 'BC-0001',
  location: 'Estante A-3',
  active: true,
  withdrawnBy: null,
  withdrawnReference: null,
  withdrawnAt: null,
}

const WITHDRAWN_COPY: LibraryCopy = {
  ...ACTIVE_COPY,
  active: false,
  withdrawnBy: 'librarian',
  withdrawnReference: 'Resolución de descarte 7 de 2026',
  withdrawnAt: '2026-10-03T14:00:00Z',
}

function fakeClient(overrides: Partial<LibraryClient> = {}): LibraryClient {
  return {
    getTitles: vi.fn(async () => [TITLE]),
    getCopies: vi.fn(async () => [ACTIVE_COPY]),
    getOpenLoans: vi.fn(async () => [OVERDUE_LOAN]),
    registerTitle: vi.fn(async () => TITLE),
    registerCopy: vi.fn(async () => ACTIVE_COPY),
    withdrawCopy: vi.fn(async () => WITHDRAWN_COPY),
    copyOfBarcode: vi.fn(async () => ACTIVE_COPY),
    returnLoan: vi.fn(async () => ({ ...OVERDUE_LOAN, returnedOn: '2026-10-03' })),
    ...overrides,
  }
}

afterEach(() => cleanup())

describe('LibraryAdminPage', () => {
  it('lists the outstanding loans and marks the overdue ones', async () => {
    // Arrange + Act
    render(<LibraryAdminPage client={fakeClient()} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)

    // Assert
    expect(await screen.findByText('Préstamos pendientes')).toBeTruthy()
    expect(screen.getByText('2026-02-01')).toBeTruthy()
    expect(screen.getByText('Vencido')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Registrar título' })).toBeNull()
  })

  it('asks the session to revalidate when the server rejects the library token', async () => {
    // Arrange: the server refuses the current bearer, so the identity has to be revalidated.
    const onAuthorizationRejected = vi.fn(async () => undefined)
    const client = fakeClient({
      getOpenLoans: vi.fn(async () => { throw new LibraryApiError(403, 'forbidden') }),
    })

    // Act
    render(<LibraryAdminPage
      client={client}
      authorization={{ accessToken: 'token', canRead: true, canWrite: false }}
      onAuthorizationRejected={onAuthorizationRejected}
    />)

    // Assert
    await waitFor(() => expect(onAuthorizationRejected).toHaveBeenCalledWith('token'))
  })

  it('does not allow withdrawing a copy without an institutional reference', async () => {
    // Arrange
    const client = fakeClient()
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)

    // Act
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')
    await screen.findByText('BC-0001')

    // Assert: the button is inert until a reference exists, and nothing was written.
    expect((screen.getByRole('button', { name: 'Retirar' }) as HTMLButtonElement).disabled).toBe(true)
    expect(client.withdrawCopy).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText('Referencia institucional del retiro'), 'Resolución 9 de 2026')
    expect((screen.getByRole('button', { name: 'Retirar' }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('registers the return of an outstanding loan with an institutional reference', async () => {
    // Arrange: the desk sees one loan on its way out, which then leaves the outstanding list.
    const client = fakeClient({
      getOpenLoans: vi.fn(async () => [OVERDUE_LOAN]).mockResolvedValueOnce([OVERDUE_LOAN]).mockResolvedValue([]),
    })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)

    // Act
    await screen.findByText('Préstamos pendientes')
    const registerReturn = () => screen.getByRole('button', { name: 'Registrar devolución' }) as HTMLButtonElement
    expect(registerReturn().disabled).toBe(true)
    await user.type(screen.getByLabelText('Referencia institucional de la devolución'), 'Devolución 1 de 2026')
    await user.click(registerReturn())

    // Assert
    await waitFor(() => expect(client.returnLoan).toHaveBeenCalledWith('loan-1', 'Devolución 1 de 2026', 'token'))
    expect(await screen.findByText('No hay ejemplares pendientes de devolución.')).toBeTruthy()
  })

  it('says when the catalogue page is only the first slice of a larger library', async () => {
    // Arrange: the API caps one page, so the desk must not read the list as complete.
    const manyTitles = Array.from({ length: 100 }, (_, index) => ({ ...TITLE, titleId: `title-${index}` }))
    render(<LibraryAdminPage
      client={fakeClient({ getTitles: vi.fn(async () => manyTitles) })}
      authorization={{ accessToken: 'token', canRead: true, canWrite: false }}
    />)

    // Act + Assert
    expect(await screen.findByText(/Mostrando los primeros 100 títulos/)).toBeTruthy()
  })

  it('asks the server to search the catalogue by name', async () => {
    // Arrange: the catalogue is too large to browse, so the desk narrows it by text.
    const client = fakeClient({
      getTitles: vi.fn(async (query: string) => (query === '' ? [TITLE] : [])),
    })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)

    // Act
    await screen.findByLabelText('Seleccionar título')
    await user.type(screen.getByLabelText('Buscar título'), 'física')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    // Assert
    await waitFor(() => expect(client.getTitles).toHaveBeenCalledWith('física', 'token', expect.anything()))
    expect(await screen.findByText('No hay títulos que coincidan con la búsqueda.')).toBeTruthy()
  })

  it('keeps the catalogue usable when the same search is submitted twice', async () => {
    // Arrange: re-submitting the same text must not leave the page stuck loading.
    const client = fakeClient({ getTitles: vi.fn(async () => [TITLE]) })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)

    // Act
    await screen.findByLabelText('Seleccionar título')
    await user.type(screen.getByLabelText('Buscar título'), 'álgebra')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))
    await screen.findByRole('option', { name: /Álgebra lineal/ })
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    // Assert
    expect(await screen.findByLabelText('Seleccionar título')).toBeTruthy()
    expect(screen.queryByText(/Consultando la biblioteca/)).toBeNull()
    expect(client.getTitles).toHaveBeenCalledTimes(3)
  })

  it('reports a failed copy read instead of pretending the title has no copies', async () => {
    // Arrange: an empty shelf and a broken request must not look the same.
    const client = fakeClient({ getCopies: vi.fn(async () => { throw new Error('offline') }) })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)

    // Act
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/no fue posible consultar/i)
    expect(screen.queryByText('Este título no tiene ejemplares registrados.')).toBeNull()
  })

  it('registers a title without reporting a failure after the write succeeded', async () => {
    // Arrange
    const client = fakeClient()
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)
    await screen.findByLabelText('Buscar título')

    // Act
    await user.type(screen.getByLabelText('Título de la obra'), 'Física moderna')
    await user.type(screen.getByLabelText('Autor'), 'Autor cuatro')
    await user.type(screen.getByLabelText('Edición'), '1a')
    await user.type(screen.getByLabelText('Referencia institucional'), 'Acta 9 de 2026')
    await user.click(screen.getByRole('button', { name: 'Registrar título' }))

    // Assert
    await waitFor(() => expect(client.registerTitle).toHaveBeenCalledTimes(1))
    expect(client.registerTitle).toHaveBeenCalledWith(
      { title: 'Física moderna', authors: ['Autor cuatro'], edition: '1a', publicationYear: null, sourceReference: 'Acta 9 de 2026' },
      'token',
    )
    expect(screen.queryByText(/no fue posible completar la operación/i)).toBeNull()
  })

  it('registers a copy without reporting a failure after the write succeeded', async () => {
    // Arrange
    const client = fakeClient({ getCopies: vi.fn(async () => [ACTIVE_COPY]) })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')
    await screen.findByText('BC-0001')

    // Act
    await user.type(screen.getByLabelText('Código de barras'), 'BC-0002')
    await user.type(screen.getByLabelText('Ubicación'), 'Estante C-2')
    await user.type(screen.getByLabelText('Referencia institucional del ejemplar'), 'Acta 10 de 2026')
    await user.click(screen.getByRole('button', { name: 'Registrar ejemplar' }))

    // Assert
    await waitFor(() => expect(client.registerCopy).toHaveBeenCalledWith(
      'title-1',
      { barcode: 'BC-0002', location: 'Estante C-2', sourceReference: 'Acta 10 de 2026' },
      'token',
    ))
    expect(screen.queryByText(/no fue posible completar la operación/i)).toBeNull()
  })

  it('narrows the outstanding list to the overdue loans on demand', async () => {
    // Arrange: the desk needs to chase what is already late without losing the whole picture.
    const client = fakeClient({ getOpenLoans: vi.fn(async () => [OVERDUE_LOAN, CURRENT_LOAN]) })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)
    await screen.findByText('Vencido')
    expect(screen.getByText('2099-01-01')).toBeTruthy()

    // Act
    await user.click(screen.getByLabelText('Solo vencidos'))

    // Assert
    expect(screen.queryByText('2099-01-01')).toBeNull()
    expect(screen.getByText('2026-02-01')).toBeTruthy()

    // Act + Assert: turning it off restores the full list.
    await user.click(screen.getByLabelText('Solo vencidos'))
    expect(await screen.findByText('2099-01-01')).toBeTruthy()
  })

  it('identifies a copy from its barcode and lets the desk withdraw it', async () => {
    // Arrange: the physical label is what the desk scans when it does not know the title.
    const copyOfBarcode = vi.fn(async () => ACTIVE_COPY)
      .mockResolvedValueOnce(ACTIVE_COPY)
      .mockResolvedValue(WITHDRAWN_COPY)
    const client = fakeClient({ copyOfBarcode })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)
    await screen.findByText('Préstamos pendientes')

    // Act
    await user.type(screen.getByLabelText('Código de barras del ejemplar'), 'BC-0001')
    await user.click(screen.getByRole('button', { name: 'Buscar ejemplar' }))

    // Assert
    await waitFor(() => expect(copyOfBarcode).toHaveBeenCalledWith('BC-0001', 'token'))
    await screen.findByText('En circulación')
    await user.type(screen.getByLabelText('Referencia institucional del retiro'), 'Resolución 9 de 2026')
    await user.click(screen.getByRole('button', { name: 'Retirar' }))

    // Assert: the same copy now shows why it left circulation.
    expect(await screen.findByText('Retirado · Resolución de descarte 7 de 2026')).toBeTruthy()
  })

  it('says when no copy carries the scanned barcode', async () => {
    // Arrange
    const client = fakeClient({
      copyOfBarcode: vi.fn(async () => { throw new LibraryApiError(404, 'missing') }),
    })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: false }} />)
    await screen.findByText('Préstamos pendientes')

    // Act
    await user.type(screen.getByLabelText('Código de barras del ejemplar'), 'BC-0000')
    await user.click(screen.getByRole('button', { name: 'Buscar ejemplar' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(/no hay ningún ejemplar con ese código de barras/i)
  })

  it('reports a failed refresh after a withdrawal that already succeeded', async () => {
    // Arrange: the write lands but the follow-up read fails; the desk must not be left with a silent stale list.
    const getCopies = vi.fn()
      .mockResolvedValueOnce([ACTIVE_COPY])
      .mockRejectedValue(new Error('offline'))
    const client = fakeClient({ getCopies })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')
    await screen.findByText('BC-0001')
    await user.type(screen.getByLabelText('Referencia institucional del retiro'), 'Resolución 9 de 2026')

    // Act
    await user.click(screen.getByRole('button', { name: 'Retirar' }))

    // Assert
    await waitFor(() => expect(client.withdrawCopy).toHaveBeenCalledTimes(1))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no fue posible actualizar/i)
  })

  it('renders nothing when the session cannot read the library', () => {
    // Arrange + Act
    const { container } = render(
      <LibraryAdminPage client={fakeClient()} authorization={{ accessToken: 'token', canRead: false, canWrite: true }} />,
    )

    // Assert
    expect(container.firstChild).toBeNull()
  })

  it('records the institutional reference when a librarian withdraws a copy', async () => {
    // Arrange
    const client = fakeClient({
      getCopies: vi.fn(async () => [ACTIVE_COPY]).mockResolvedValueOnce([ACTIVE_COPY]).mockResolvedValue([WITHDRAWN_COPY]),
    })
    const user = userEvent.setup()
    render(<LibraryAdminPage client={client} authorization={{ accessToken: 'token', canRead: true, canWrite: true }} />)

    // Act
    await user.selectOptions(await screen.findByLabelText('Seleccionar título'), 'title-1')
    await screen.findByText('BC-0001')
    await user.type(screen.getByLabelText('Referencia institucional del retiro'), 'Resolución de descarte 7 de 2026')
    await user.click(screen.getByRole('button', { name: 'Retirar' }))

    // Assert
    await waitFor(() => expect(client.withdrawCopy).toHaveBeenCalledWith('copy-1', 'Resolución de descarte 7 de 2026', 'token'))
    expect(await screen.findByText('Retirado · Resolución de descarte 7 de 2026')).toBeTruthy()
  })
})
