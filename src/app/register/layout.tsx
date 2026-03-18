import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Join atpost',
}

export default function RegisterLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
