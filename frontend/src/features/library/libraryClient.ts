import type {
  LibraryCopy,
  LibraryLoan,
  LibraryTitle,
  RegisterLibraryCopyInput,
  RegisterLibraryTitleInput,
} from './libraryContracts'

export interface LibraryClient {
  getTitles(query: string, accessToken: string, signal?: AbortSignal): Promise<LibraryTitle[]>
  getCopies(titleId: string, accessToken: string, signal?: AbortSignal): Promise<LibraryCopy[]>
  getOpenLoans(accessToken: string, signal?: AbortSignal): Promise<LibraryLoan[]>
  copyOfBarcode(barcode: string, accessToken: string, signal?: AbortSignal): Promise<LibraryCopy>
  registerTitle(input: RegisterLibraryTitleInput, accessToken: string): Promise<LibraryTitle>
  registerCopy(titleId: string, input: RegisterLibraryCopyInput, accessToken: string): Promise<LibraryCopy>
  withdrawCopy(copyId: string, sourceReference: string, accessToken: string): Promise<LibraryCopy>
  returnLoan(loanId: string, sourceReference: string, accessToken: string): Promise<LibraryLoan>
}

export class LibraryApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'LibraryApiError'
    this.status = status
  }
}

const BASE = '/api/v1/admin/library'

/** The most the API will return in one page, so the desk asks for the whole window it is allowed to see. */
export const LIST_LIMIT = 100

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

export function createLibraryClient(fetcher: typeof fetch = fetch): LibraryClient {
  async function request<T>(path: string, accessToken: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, signal } = options
    const response = await fetcher(`${BASE}${path}`, {
      method,
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(signal ? { signal } : {}),
    })
    if (!response.ok) {
      throw new LibraryApiError(response.status, 'No fue posible completar la operación de biblioteca.')
    }
    return (await response.json()) as T
  }

  return {
    getTitles: (query, accessToken, signal) =>
      request<LibraryTitle[]>(
        `/titles?limit=${LIST_LIMIT}${query ? `&query=${encodeURIComponent(query)}` : ''}`,
        accessToken,
        { signal },
      ),
    getCopies: (titleId, accessToken, signal) =>
      request<LibraryCopy[]>(`/titles/${encodeURIComponent(titleId)}/copies?limit=${LIST_LIMIT}`, accessToken, { signal }),
    getOpenLoans: (accessToken, signal) =>
      request<LibraryLoan[]>(`/open-loans?limit=${LIST_LIMIT}`, accessToken, { signal }),
    copyOfBarcode: (barcode, accessToken, signal) =>
      request<LibraryCopy>(`/copies/by-barcode/${encodeURIComponent(barcode)}`, accessToken, { signal }),
    registerTitle: (input, accessToken) =>
      request<LibraryTitle>('/titles', accessToken, { method: 'POST', body: input }),
    registerCopy: (titleId, input, accessToken) =>
      request<LibraryCopy>(`/titles/${encodeURIComponent(titleId)}/copies`, accessToken, {
        method: 'POST',
        body: input,
      }),
    withdrawCopy: (copyId, sourceReference, accessToken) =>
      request<LibraryCopy>(`/copies/${encodeURIComponent(copyId)}/withdraw`, accessToken, {
        method: 'POST',
        body: { sourceReference },
      }),
    // The date is omitted on purpose: the backend stamps the return with the institutional clock.
    returnLoan: (loanId, sourceReference, accessToken) =>
      request<LibraryLoan>(`/loans/${encodeURIComponent(loanId)}/return`, accessToken, {
        method: 'POST',
        body: { sourceReference },
      }),
  }
}

export const libraryClient = createLibraryClient()
