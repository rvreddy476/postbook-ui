import { EchoShell } from "@/features/echo/components/EchoShell"

/*
  Every /echo page renders inside Echo's own X-style shell
  (echo-v2-contract.md §5): no VChat header or rail. The product gate
  (components/ProductRouteGate in app/providers) still shows "Not
  available" while GET /v1/features says Echo is closed, so nothing here
  calls an Echo route then. `modal` is the compose modal slot.
*/
export default function EchoLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return <EchoShell modal={modal}>{children}</EchoShell>
}
