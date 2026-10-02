/*
  Client config (mechanic M18): GET /client-config → {screen_protection}.

  The switches the apps act on locally. On Android, screen_protection blocks
  screenshots and screen recording on Pulse screens. A web page cannot do
  that — any browser can capture its own window — so the web parses the
  value, keeps it here, and changes nothing on screen. Drawing a "protected"
  badge would promise something the web can't deliver.
*/

import { bool, obj } from "./wire"

export interface ClientConfig {
  /** Android blocks screen capture while this is on. The web does nothing with it (see above). */
  screenProtection: boolean
}

export function toClientConfig(wire: unknown): ClientConfig {
  return { screenProtection: bool(obj(wire).screen_protection) }
}
