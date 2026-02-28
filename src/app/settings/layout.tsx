export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <main className="min-h-screen bg-[#fcfaff]">
            {children}
        </main>
    )
}
