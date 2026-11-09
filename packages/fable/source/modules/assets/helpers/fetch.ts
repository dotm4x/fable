/**
 * Fetches a source and rejects unsuccessful HTTP responses.
 *
 * @internal
 * @param source - Source passed to `fetch`.
 * @param signal - Signal aborted when the request is no longer needed.
 * @returns The successful response.
 */
export async function fetchSource(source: string, signal: AbortSignal): Promise<Response> {
  const response = await fetch(source, { signal })
  if (!response.ok) {
    throw new Error(`Loading '${source}' failed with status ${String(response.status)}.`)
  }

  return response
}
