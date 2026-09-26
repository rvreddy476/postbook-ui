import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (path: string) => readFileSync(resolve(import.meta.dir, '../../..', path), 'utf8')

// Wiring guards only; native focus/top-layer and responsive behaviour are browser-verified.
describe('group composer modal wiring', () => {
  test('only the editing body scrolls; expanded tools stay inside that body', () => {
    const css = source('components/groups/group-post-dialog.css')
    const panel = css.match(/\.group-post-dialog \.post-composer__panel \{([^}]+)\}/)?.[1] ?? ''
    const body = css.match(/\.group-post-dialog \.post-composer__body \{([^}]+)\}/)?.[1] ?? ''
    expect(panel).toContain('overflow: hidden')
    expect(panel).toContain('display: flex')
    expect(body).toContain('overflow-y: auto')
    const code = source('components/CreatePortal.tsx')
    const start = code.indexOf('className="post-composer__body')
    const end = code.indexOf('className="post-composer__tools', start)
    expect(code.slice(start, end)).toContain('{isGroupMode && moreControls}')
    expect(code.slice(start, end)).toContain('{isGroupMode && errorNotice}')
  })
  test('every group entry point uses the shared top-layer modal', () => {
    for (const file of ['components/groups/GroupView.tsx', 'components/groups/tabs/GroupFeedTab.tsx', 'app/groups/page.tsx']) {
      const code = source(file)
      expect(code).toContain('<GroupPostDialog')
      expect(code).not.toContain('<CreatePortal')
    }
  })
  test('dialog mounts outside page stacking contexts and restores the opener and body', () => {
    const code = source('components/groups/GroupPostDialog.tsx')
    expect(code).toContain('<dialog')
    expect(code).toContain('dialog?.showModal()')
    expect(code).toContain('document.body,')
    expect(code).toContain('document.body.style.overflow = previousOverflow')
    expect(code).toContain('trigger.focus()')
    expect(code).toContain('aria-label="Create group post"')
  })
  test('a failed additional-group lookup is not represented as an empty membership list', () => {
    const code = source('components/groups/CrossPostPicker.tsx')
    expect(code).toContain('groups.isError ?')
    expect(code).toContain('Your other groups could not load.')
    expect(code).toContain('onClick={() => groups.refetch()}')
  })
})
