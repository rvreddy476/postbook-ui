import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { AxiosError } from 'axios'
import api from '@/lib/api'
import { publicPostAuthorIds, publicCommentAuthorIds, canRevealGroupAuthor, anonymousAttachmentRefusal } from '../anonymousIdentity'
import { normalizeComment, CommentRow } from '../GroupPostCommentSection'
import { requestAuthorReveal } from '../useAuthorReveal'

test('profile batches exclude anonymous post and comment aliases', () => {
  expect(publicPostAuthorIds([{author_id:'alias',is_anonymous:true},{author_id:'named'},{author_id:'named'}])).toEqual(['named'])
  expect(publicCommentAuthorIds([{user_id:'alias',is_anonymous:true},{user_id:'legacy-alias'},{user_id:'named'}], 'legacy-alias')).toEqual(['named'])
})

test('only owner, admin and moderator may offer reveal, and only on anonymous posts', () => {
  for (const role of ['owner','admin','moderator']) expect(canRevealGroupAuthor(true,role)).toBe(true)
  for (const role of ['member','outsider','banned','pending','author',undefined]) expect(canRevealGroupAuthor(true,role)).toBe(false)
  expect(canRevealGroupAuthor(false,'owner')).toBe(false)
})

test('anonymous author comments and replies ignore leaked enrichment and render a neutral identity', () => {
  const comment=normalizeComment({id:'c',post_id:'p',user_id:'alias',is_anonymous:true,user_name:'Secret name',user_avatar:'/secret-photo',body:'Hello',created_at:new Date().toISOString()})
  expect(comment.user_id).toBe('alias')
  expect(comment.user_avatar).toBeUndefined()
  for (const isReply of [false,true]) {
    const html=renderToStaticMarkup(<CommentRow comment={comment} currentUserId="viewer" currentUserName="Viewer" isReply={isReply} replyOpen={false} onToggleReply={()=>{}} onSubmitReply={()=>{}} onCancelReply={()=>{}} onDelete={()=>{}} />)
    expect(html).toContain('Anonymous member (author)')
    expect(html).not.toContain('Secret name')
    expect(html).not.toContain('/secret-photo')
    expect(html).not.toContain('href=')
  }
})

test('reveal performs explicit no-store reads, then reads only the real profile', async () => {
  const previous=api.defaults.adapter
  const requests: string[]=[]
  api.defaults.adapter=async config=>{
    requests.push(config.url!)
    expect(config.headers.get('Cache-Control')).toBe('no-store')
    const data=config.url!.endsWith('/author') ? {post_id:'p',author_id:'real',is_anonymous:true,revealed_at:'now'} : {user_id:'real',display_name:'Moderator-only identity'}
    return {data:{data},status:200,statusText:'OK',headers:{'cache-control':'private, no-store'},config}
  }
  try {
    expect((await requestAuthorReveal('g','p',new AbortController().signal)).name).toBe('Moderator-only identity')
    expect(requests).toEqual(['/v1/groups/g/posts/v2/p/author','/v1/profiles/real'])
  } finally {api.defaults.adapter=previous}
})

test('403 or 404 reveal never proceeds to a profile lookup', async () => {
  const previous=api.defaults.adapter
  try {
    for (const status of [403,404]) {
      const requests:string[]=[]
      api.defaults.adapter=async config=>{ requests.push(config.url!); throw new AxiosError('Refused',undefined,config,undefined,{data:{},status,statusText:'Refused',headers:{},config}) }
      await expect(requestAuthorReveal('g','p',new AbortController().signal)).rejects.toThrow()
      expect(requests).toEqual(['/v1/groups/g/posts/v2/p/author'])
    }
  } finally {api.defaults.adapter=previous}
})

test('attachment anonymity refusal selects retry-and-retain-draft copy only for the specified failure', () => {
  expect(anonymousAttachmentRefusal({response:{status:500,data:{error:{message:'unavailable: attachments could not be made anonymous; try again'}}}})).toBe(true)
  expect(anonymousAttachmentRefusal({response:{status:403,data:{error:'forbidden'}}})).toBe(false)
  expect(anonymousAttachmentRefusal(undefined)).toBe(false)
})
