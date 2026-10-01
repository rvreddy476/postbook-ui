import { MAX_MODERATORS } from "../model"
import { streamTools, type ChatRole } from "../chat"

/**
 * Host / moderator tools outside a single message: who is banned (with
 * Unban) and, for the host only, the moderator list. Viewers never get it.
 *
 * The lists are the server's: GET /streams/:id/bans (host, moderators) and
 * GET /streams/:id/moderators, kept current by moderation.ban / unban /
 * moderators frames while the page is open.
 */
export function ModerationPanel({
  role,
  banned,
  moderators,
  nameOf,
  onUnban,
  onRemoveModerator,
  busy,
}: {
  role: ChatRole
  banned: string[]
  moderators: string[]
  nameOf: (userId: string) => string
  onUnban: (userId: string) => void
  onRemoveModerator: (userId: string) => void
  busy?: boolean
}) {
  const tools = streamTools(role)
  if (!tools.moderationPanel) return null
  const byName = (a: string, b: string) => nameOf(a).localeCompare(nameOf(b))
  return (
    <details className="live-section live-moderation" data-testid="live-moderation">
      <summary>Moderation tools <span className="live-page__meta">{banned.length} banned · {moderators.length} moderators</span></summary>
      <div className="live-moderation__body">
      <div className="live-section__title">Banned from this stream</div>
      {banned.length === 0 ? (
        <p className="live-page__meta">No one is banned.</p>
      ) : (
        <div className="live-list">
          {[...banned].sort(byName).map((id) => (
            <div key={id} className="live-list__row">
              <span>{nameOf(id)}</span>
              <button type="button" className="live-btn live-btn--ghost" disabled={busy} onClick={() => onUnban(id)}>
                Unban
              </button>
            </div>
          ))}
        </div>
      )}
      {tools.setModerators && (
        <>
          <div className="live-section__title mt-3">
            Moderators <span className="live-page__meta">({moderators.length}/{MAX_MODERATORS})</span>
          </div>
          {moderators.length === 0 ? (
            <p className="live-page__meta">Choose up to {MAX_MODERATORS} from a chat message&apos;s menu.</p>
          ) : (
            <div className="live-list">
              {[...moderators].sort(byName).map((id) => (
                <div key={id} className="live-list__row">
                  <span>{nameOf(id)}</span>
                  <button type="button" className="live-btn live-btn--ghost" disabled={busy} onClick={() => onRemoveModerator(id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      </div>
    </details>
  )
}
