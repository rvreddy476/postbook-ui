'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, BriefcaseBusiness, Coffee, Gamepad2, GraduationCap, Grid2X2, Heart, Leaf, Monitor, Palette, Users } from 'lucide-react'
import { useJoinGroup } from '@/hooks/useGroups'
import type { Group } from '@/types/groups'
import './group-discovery.css'

const topics = [
  {name:'All',icon:Grid2X2,match:[]},
  {name:'Technology',icon:Monitor,match:['technology','tech']},
  {name:'Business',icon:BriefcaseBusiness,match:['business']},
  {name:'Design',icon:Palette,match:['design','art','arts']},
  {name:'Health & Wellness',icon:Leaf,match:['health','wellness','fitness','health & wellness']},
  {name:'Education',icon:GraduationCap,match:['education','learning']},
  {name:'Lifestyle',icon:Coffee,match:['lifestyle','travel','food']},
  {name:'Entertainment',icon:Gamepad2,match:['entertainment','gaming','music']},
]
export function filterDiscoveryGroups(groups:Group[], topic:string) {
  const selected=topics.find(item=>item.name===topic)
  return !selected?.match.length ? groups : groups.filter(group=>selected.match.includes((group.category ?? '').toLowerCase().trim()))
}
function DiscoveryCard({group,joined,compact=false}:{group:Group;joined:boolean;compact?:boolean}) {
  const join=useJoinGroup()
  const [result,setResult]=useState<string|null>(null)
  const [failed,setFailed]=useState(false)
  const role=group.viewer_role
  const member=joined || ['owner','admin','moderator','member'].includes(role ?? '') || result==='joined'
  const pending=role==='pending'||result==='pending'
  const href=`/groups/${group.handle || group.id}`
  const request=group.join_mode==='request'
  return <article className={`discovery-card ${compact?'discovery-card--compact':''}`}>
    {!compact&&<Link href={href} className="discovery-card__cover" tabIndex={-1} aria-hidden="true">
      {group.cover_media_id?<img src={`/v1/media/${group.cover_media_id}/serve`} alt="" loading="lazy"/>:<div className="discovery-card__cover-art"><Users size={74}/><span/><span/></div>}
    </Link>}
    <div className="discovery-card__body">
      <div className="discovery-card__avatar">{group.avatar_media_id?<img src={`/v1/media/${group.avatar_media_id}/serve`} alt="" loading="lazy"/>:<Users size={25}/>}</div>
      <div className="discovery-card__copy"><Link href={href}><h3>{group.name}</h3></Link>{!compact&&<p>{group.description || 'A place to share ideas and connect.'}</p>}</div>
      <div className="discovery-card__footer"><span><Users size={14}/>{group.member_count.toLocaleString()} members</span>
        {member?<Link href={href} className="discovery-card__join">Open <ArrowUpRight size={14}/></Link>:pending?<span className="discovery-card__join">Requested</span>:group.join_mode==='invite_only'||role==='banned'?<Link href={href} className="discovery-card__join">View</Link>:<button className="discovery-card__join" disabled={join.isPending} onClick={()=>{
          setFailed(false)
          join.mutate(group.id,{onSuccess:response=>setResult(response.status==='pending'?'pending':'joined'),onError:()=>setFailed(true)})
        }}>{join.isPending?'Joining…':request?'Request to join':'Join'}</button>}
      </div>
      {failed&&<p role="alert" className="discovery-card__error">Could not join. Please try again.</p>}
    </div>
  </article>
}
export default function GroupDiscovery({groups,myGroups,loading,error,onRetry,searching=false}:{groups:Group[];myGroups:Group[];loading:boolean;error:boolean;onRetry:()=>void;searching?:boolean}) {
  const [topic,setTopic]=useState('All')
  const [all,setAll]=useState(false)
  const matching=useMemo(()=>filterDiscoveryGroups(groups,topic),[groups,topic])
  const joined=new Set(myGroups.map(group=>group.id))
  const popular=useMemo(()=>[...matching].sort((a,b)=>b.member_count-a.member_count).slice(0,3),[matching])
  return <section className="group-discovery" aria-label="Discover groups">
    <nav className="discovery-topics" aria-label="Group topics">{topics.map(({name,icon:Icon})=><button key={name} aria-pressed={topic===name} onClick={()=>{setTopic(name);setAll(false)}}><Icon size={17}/>{name}</button>)}</nav>
    <div className="discovery-section-heading"><div><h2>{searching?'Search results':'Groups to explore'}</h2><p>{topic==='All'?'Find a community for the things you care about.':`${topic} communities in these results.`}</p></div>{matching.length>4&&<button onClick={()=>setAll(value=>!value)}>{all?'Show less':'See all'}</button>}</div>
    {loading?<div className="discovery-grid" aria-label="Loading groups">{[1,2,3,4].map(key=><div key={key} className="discovery-skeleton"/>)}</div>:error?<div className="discovery-empty" role="alert">Groups could not load. <button onClick={onRetry}>Try again</button></div>:matching.length===0?<div className="discovery-empty"><Users size={28}/><h3>No groups found</h3><p>Try another topic or search.</p>{topic!=='All'&&<button onClick={()=>setTopic('All')}>Show all topics</button>}</div>:<div className="discovery-grid">{(all?matching:matching.slice(0,4)).map(group=><DiscoveryCard key={group.id} group={group} joined={joined.has(group.id)}/>)}</div>}
    {!loading&&!error&&!searching&&<div className="discovery-bottom">
      <section><div className="discovery-section-heading"><div><h2>Popular communities</h2><p>Explore by community size.</p></div></div><div className="discovery-popular">{popular.map(group=><DiscoveryCard key={group.id} group={group} joined={joined.has(group.id)} compact/>)}</div></section>
      <aside className="discovery-benefits"><h3>Why join groups?</h3><div><Users/><p><strong>Find your people</strong><span>Connect around the interests you share.</span></p></div><div><GraduationCap/><p><strong>Learn something new</strong><span>Exchange ideas and different perspectives.</span></p></div><div><Heart/><p><strong>Make room for connection</strong><span>Small conversations. Lasting friendships.</span></p></div></aside>
    </div>}
  </section>
}
