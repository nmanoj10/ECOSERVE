import type { ReactNode } from 'react'

/** Matches `https://…` / `http://…` URL tokens inside a message. */
const URL_PATTERN = /(https?:\/\/[^\s]+)/g

/**
 * Renders a notification message, turning embedded URLs into clickable links
 * that open in a new tab. Rescue alerts embed a Google Maps location link
 * (`Location: https://maps.google.com/?q=lat,lng`) that would otherwise be
 * inert plain text the user can't click.
 */
export function MessageWithLinks({ message }: { message: string }): ReactNode {
  return message.split(URL_PATTERN).map((part, i) => {
    if (!part.startsWith('http')) return <span key={i}>{part}</span>

    // Trim trailing punctuation so it isn't swallowed into the href
    // (e.g. `…?q=12.97,77.59.` or `…?q=12.97,77.59,` between spots).
    const url = part.replace(/[.,;:!?)\]]+$/, '')
    const tail = part.slice(url.length)
    return (
      <span key={i}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="break-all font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {url}
        </a>
        {tail}
      </span>
    )
  })
}