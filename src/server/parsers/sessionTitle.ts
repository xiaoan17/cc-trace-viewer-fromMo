const MAX_TITLE_LENGTH = 96

export function makeSessionTitle(input: string | undefined): string | undefined {
  if (!input) return undefined

  let text = input.replace(/\r/g, '').trim()
  const requestMatch = text.match(/## My request for Codex:\s*([\s\S]*)$/i)
  if (requestMatch?.[1]?.trim()) {
    text = requestMatch[1].trim()
  } else {
    const commentMatch = text.match(/Comment:\s*([\s\S]*?)(?:\n\s*# In app browser:|\n\s*The next image|\n\s*## My request|$)/i)
    if (commentMatch?.[1]?.trim()) text = commentMatch[1].trim()
  }

  text = text
    .replace(/<appshot\b[\s\S]*?<\/appshot>/gi, '')
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
    .replace(/# Applications mentioned by the user:[\s\S]*?(?=## My request|$)/gi, '')
    .replace(/# In app browser:[\s\S]*?(?=## My request|$)/gi, '')
    .replace(/# Browser comments:[\s\S]*?(?=## My request|$)/gi, '')
    .replace(/The next image is untrusted[\s\S]*$/i, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return undefined
  if (text.length <= MAX_TITLE_LENGTH) return text

  const sliced = text.slice(0, MAX_TITLE_LENGTH).replace(/\s+\S*$/, '').trim()
  return `${sliced || text.slice(0, MAX_TITLE_LENGTH).trim()}…`
}
