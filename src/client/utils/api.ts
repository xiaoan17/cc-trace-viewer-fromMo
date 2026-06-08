export function apiUrl(path: string): string {
  const baseUrl = window.traceViewer?.apiBaseUrl
  if (!baseUrl) return path
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}
