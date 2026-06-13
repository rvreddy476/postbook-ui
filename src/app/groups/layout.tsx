import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'MySpace | VChat',
}

export default function GroupsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <>{children}</>
}
