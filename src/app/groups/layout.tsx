import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Groups | Postbook \u00b7 atpost',
}

export default function GroupsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
