import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GroupDiscovery, { filterDiscoveryGroups } from '../GroupDiscovery'
import ReactionControl from '@/components/reactions/ReactionControl'
import { REACTIONS, normalizeReaction, postReactionName } from '@/lib/reactions'
import { parsePostReaction, patchPostReactions } from '@/hooks/useFeedReaction'
import type { Group } from '@/types/groups'

const groups=[{id:'tech',name:'Builders',description:'Build together',category:'technology',member_count:14,viewer_role:'outsider',join_mode:'open'}, {id:'art',name:'Art circle',category:'art',member_count:8}, {id:'unset',name:'Family',member_count:3}] as Group[]
test('topics filter real categories, never invent metadata for unclassified groups',()=>{
 expect(filterDiscoveryGroups(groups,'All')).toHaveLength(3)
 expect(filterDiscoveryGroups(groups,'Technology').map(g=>g.id)).toEqual(['tech'])
 expect(filterDiscoveryGroups(groups,'Design').map(g=>g.id)).toEqual(['art'])
 expect(filterDiscoveryGroups(groups,'Education')).toHaveLength(0)
})
test('discovery uses actual names/counts and renders honest empty/error states',()=>{
 const qc=new QueryClient()
 const render=(props:Partial<React.ComponentProps<typeof GroupDiscovery>>={})=>renderToStaticMarkup(<QueryClientProvider client={qc}><GroupDiscovery groups={groups} myGroups={[groups[0]]} loading={false} error={false} onRetry={()=>{}} {...props}/></QueryClientProvider>)
 const html=render()
 expect(html).toContain('Builders');expect(html).toContain('14');expect(html).toContain('Open')
 expect(html).not.toContain('32%');expect(html).not.toContain('Handpicked')
 expect(render({groups:[]})).toContain('No groups found')
 expect(render({error:true})).toContain('Groups could not load')
 qc.clear()
})
test('one six-choice vocabulary maps Smile to the post-service haha wire value',()=>{
 expect(REACTIONS).toHaveLength(6)
 for(const option of REACTIONS) expect(normalizeReaction(postReactionName(option.value))).toBe(option.value)
 expect(normalizeReaction({type:'love'})).toBe('love')
 expect(normalizeReaction('unsupported')).toBeNull()
})
test('shared control supports both six-reaction and like-only service capabilities without a spinner',()=>{
 const render=(allowed?:readonly ['like'])=>renderToStaticMarkup(<ReactionControl current="love" count={12} onChange={async()=>{}} allowed={allowed}/>)
 expect(render()).toContain('Choose reaction')
 expect(render()).toContain('Remove Love reaction')
 expect(render()).not.toContain('animate-spin')
 expect(render(['like'])).not.toContain('Choose reaction')
})
test('post reaction acknowledgement replaces all relevant caches with its exact server total',()=>{
 const qc=new QueryClient()
 const post={id:'p',viewer_reaction:'like',counts:{likes:3,comments:9}}
 qc.setQueryData(['home-feed','ranked'],{pages:[{data:[post,{...post,id:'other'}],cursor:'keep'}],pageParams:['keep']})
 qc.setQueryData(['profile-posts','u'],{pages:[{data:[post]}]})
 qc.setQueryData(['post-detail','p'],post)
 const state=parsePostReaction({data:{reaction_type:'haha',is_set:true,counts:{haha:2,total:27}}})
 patchPostReactions(qc,'p',state)
 expect(qc.getQueryData(['post-detail','p'])).toEqual({...post,viewer_reaction:'haha',counts:{likes:27,comments:9}})
 const home:any=qc.getQueryData(['home-feed','ranked'])
 expect(home.pages[0].data[0].counts.likes).toBe(27)
 expect(home.pages[0].data[1].counts.likes).toBe(3)
 expect(home.pageParams).toEqual(['keep'])
 patchPostReactions(qc,'p',parsePostReaction({data:{reaction_type:'',is_set:false,counts:{total:26}}}))
 expect(qc.getQueryData(['post-detail','p'])).toMatchObject({viewer_reaction:null,counts:{likes:26}})
 qc.clear()
})
test('missing optional counts never fabricate a total and malformed states are rejected',()=>{
 expect(parsePostReaction({data:{reaction_type:'love',is_set:true,counts:null}})).toEqual({reaction:'love',counts:null})
 for(const data of [{reaction_type:'unknown',is_set:true},{reaction_type:'like',is_set:true,counts:{total:-1}},{reaction_type:'like'}]) expect(()=>parsePostReaction({data})).toThrow()
})
