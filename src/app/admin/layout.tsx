import { AdminWorkspace } from "@/features/video-shell/AdminWorkspace"
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>
}
