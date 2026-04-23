import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ask · atpost',
  description: 'Ask questions, share knowledge.',
}

export default function QALayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        body { background: #f8f9fa !important; }
      ` }} />
      {children}
    </>
  )
}
