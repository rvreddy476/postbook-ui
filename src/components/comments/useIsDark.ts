'use client'
import { useEffect, useState } from 'react'

/** Follows the document's `dark` class, which the layout bootstrap and the Header toggle set. */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains('dark'))
    read()
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return dark
}
