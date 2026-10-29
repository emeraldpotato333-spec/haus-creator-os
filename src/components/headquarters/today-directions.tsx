'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, BookOpen, Columns3, LayoutGrid, RefreshCw, Settings2, Users } from 'lucide-react';
import type { HqRecordEnvelope } from '@/lib/hq-validation';
import { Face, ago, ask, due, firstName, initials, safeUrl } from '@/components/headquarters/desk/parts';

type Direction = 'focus' | 'lanes' | 'faces';
const directions: { id: Direction; label: string }[] = [
  { id: 'focus', label: 'A  Focus' },
  { id: 'lanes', label: 'B  Lanes' },
  { id: 'faces', label: 'C  Faces' },
];

// Nav targets the existing headquarters views, which keep working while the
// new Today page is only a preview.
const nav = [
  { label: 'Today', icon: LayoutGrid, href: '/headquarters/directions' },
  { label: 'People', icon: Users, href: '/headquarters?view=people' },
  { label: 'Pipeline', icon: Columns3, href: '/headquarters?view=pipeline' },
  { label: 'Playbook', icon: BookOpen, href: '/headquarters?view=playbook' },
  { label: 'Settings', icon: Settings2, href: '/headquarters?view=settings' },
];

const openHref = (r: HqRecordEnvelope) => '/headquarters?creator=' + encodeURIComponent(r.id);

function useRecords() {
  const [records, setRecords] = useState<HqRecordEnvelope[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetch('/api/headquarters', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRecords(body.records);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);
  // Network completion, not a synchronous effect update.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  return { records, state, load };
}

// Same queue rules as headquarters.tsx, so every direction shows the same people.
function derive(records: HqRecordEnvelope[]) {
  const active = records.filter((r) => r.data.stage !== 'archived' && r.data.queueCategory !== 'research' && !r.data.needsReconciliation);
  const ready = active.filter((r) => r.data.decisionStatus === 'ready');
  const queue = active
    .filter((r) => r.data.waitingOn !== 'creator' && r.data.taskState !== 'done' && r.data.decisionStatus !== 'ready')
    .sort((a, b) => (a.data.dueDate ?? '9999').localeCompare(b.data.dueDate ?? '9999'));
  const yours = queue.filter((r) => r.data.waitingOn === 'william' || r.data.owner === 'William');
  const agents = queue.filter((r) => !yours.includes(r));
  const waiting = active.filter((r) => r.data.waitingOn === 'creator').sort((a, b) => (a.data.dueDate ?? '9999').localeCompare(b.data.dueDate ?? '9999'));
  const backlog = records.filter((r) => r.data.queueCategory !== 'research' && r.data.needsReconciliation && r.data.stage !== 'archived');
  const hero = ready[0] ?? yours[0] ?? null;
  const yourRest = [...ready, ...yours].filter((r) => r !== hero);
  return { hero, heroIsDecision: Boolean(ready[0]), yourRest, yourCount: ready.length + yours.length, agents, waiting, backlog };
}
type Lists = ReturnType<typeof derive>;

function Hero({ l, compact = false, quote = false }: { l: Lists; compact?: boolean; quote?: boolean }) {
  if (!l.hero) {
    return (
      <section className="td-hero is-clear">
        <div className="td-hero-body">
          <h2>Nothing is waiting on you</h2>
          <p>{l.agents.length} people are with the agents and {l.waiting.length} are waiting on a reply.</p>
        </div>
      </section>
    );
  }
  const r = l.hero;
  const channel = r.data.channels?.[0];
  const said = quote && r.data.lastMessageDirection === 'inbound' && r.data.latestMessage;
  return (
    <section className={'td-hero' + (compact ? ' is-compact' : '') + (said ? ' has-quote' : '')}>
      <a className="td-hero-face" href={openHref(r)} aria-label={'Open ' + r.data.name}><Face r={r} size={compact ? 56 : 88} /></a>
      <div className="td-hero-body">
        <span className="td-chip is-accent">{l.heroIsDecision ? 'Decision ready' : 'Your turn'}</span>
        <h2><a href={openHref(r)}>{r.data.name}</a></h2>
        <p>{ask(l.heroIsDecision ? r.data.decisionReason || r.data.nextAction : r.data.nextAction, compact ? 110 : 160)}</p>
        <div className="td-hero-actions">
          <a className="td-primary" href={openHref(r)}>{l.heroIsDecision ? 'Review decision' : `Open ${firstName(r.data.name)}`} <ArrowRight size={17} /></a>
          {channel && <a className="td-quiet" href={channel.url} target="_blank" rel="noreferrer">{channel.label} <ArrowUpRight size={16} /></a>}
        </div>
      </div>
      {said && (
        <blockquote className="td-hero-quote">
          <p>{r.data.latestMessage}</p>
          <footer>{firstName(r.data.name)} wrote {ago(r.data.lastMessageAt)}</footer>
        </blockquote>
      )}
    </section>
  );
}

function Row({ r, showDue = true }: { r: HqRecordEnvelope; showDue?: boolean }) {
  const d = due(r.data.dueDate);
  return (
    <a className="td-row" href={openHref(r)}>
      <Face r={r} />
      <span className="td-row-text"><strong>{r.data.name}</strong><span>{ask(r.data.nextAction, 96)}</span></span>
      {showDue && <span className={'td-due' + (d.late ? ' is-late' : '')}>{d.text}</span>}
    </a>
  );
}

function FaceCluster({ people }: { people: HqRecordEnvelope[] }) {
  return (
    <div className="td-cluster">
      {people.map((r) => (
        <a key={r.id} href={openHref(r)} className="td-cluster-item" title={r.data.name}>
          <Face r={r} size={52} />
          <span>{firstName(r.data.name)}</span>
        </a>
      ))}
    </div>
  );
}

function Backlog({ count }: { count: number }) {
  if (!count) return null;
  return (
    <a className="td-backlog" href="/headquarters?view=people&show=reconciliation">
      <span><strong>{count} older threads</strong> need a source check before anyone replies</span>
      <ArrowRight size={17} />
    </a>
  );
}

// A: one decision, then your list, with the team's work kept to faces.
function Focus({ l }: { l: Lists }) {
  return (
    <>
      <Hero l={l} quote />
      <div className="td-focus-grid">
        <section>
          <header className="td-section"><h3>Also on you</h3><span className="td-count">{l.yourRest.length}</span></header>
          {l.yourRest.length ? <div className="td-list">{l.yourRest.map((r) => <Row key={r.id} r={r} />)}</div> : <p className="td-empty">That’s everything for you today</p>}
          <Backlog count={l.backlog.length} />
        </section>
        <aside>
          <header className="td-section"><h3>With the agents</h3><span className="td-count">{l.agents.length}</span></header>
          <FaceCluster people={l.agents} />
          <header className="td-section"><h3>Waiting on them</h3><span className="td-count">{l.waiting.length}</span></header>
          <FaceCluster people={l.waiting} />
        </aside>
      </div>
    </>
  );
}

// B: three owner lanes side by side, everything readable at once.
function Lanes({ l }: { l: Lists }) {
  const lanes = [
    { title: 'You', people: l.yourRest, lead: true },
    { title: 'Agents', people: l.agents },
    { title: 'Them', people: l.waiting },
  ];
  return (
    <>
      <div className="td-lanes">
        {lanes.map((lane) => (
          <section key={lane.title} className="td-lane">
            <header className="td-section"><h3>{lane.title}</h3><span className="td-count">{lane.people.length + (lane.lead && l.hero ? 1 : 0)}</span></header>
            {lane.lead && <Hero l={l} compact />}
            <div className="td-lane-cards">
              {lane.people.map((r) => (
                <a key={r.id} className="td-card" href={openHref(r)}>
                  <span className="td-card-top"><Face r={r} size={40} /><strong>{r.data.name}</strong></span>
                  <p>{ask(r.data.nextAction, 110)}</p>
                  <span className={'td-due' + (due(r.data.dueDate).late ? ' is-late' : '')}>{due(r.data.dueDate).text}</span>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
      <Backlog count={l.backlog.length} />
    </>
  );
}

// C: people first. Portrait tiles ordered by who needs to move.
function Faces({ l }: { l: Lists }) {
  const tiles = [
    ...l.yourRest.map((r) => ({ r, chip: 'Your turn', accent: true })),
    ...l.agents.map((r) => ({ r, chip: 'Agent', accent: false })),
    ...l.waiting.map((r) => ({ r, chip: 'Waiting', accent: false })),
  ];
  return (
    <>
      <Hero l={l} />
      <header className="td-section"><h3>Everyone in motion</h3><span className="td-count">{tiles.length}</span></header>
      <div className="td-tiles">
        {tiles.map(({ r, chip, accent }) => {
          const src = safeUrl(r.data.profileImageUrl);
          return (
            <a key={r.id} className="td-tile" href={openHref(r)}>
              <span className="td-tile-photo">
                {src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
                <span aria-hidden="true">{initials(r.data.name)}</span>
              </span>
              <strong>{r.data.name}</strong>
              <span className="td-tile-meta"><span className={'td-chip' + (accent ? ' is-accent' : '')}>{chip}</span><span>{due(r.data.dueDate).text}</span></span>
            </a>
          );
        })}
      </div>
      <Backlog count={l.backlog.length} />
    </>
  );
}

export function TodayDirections() {
  const { records, state, load } = useRecords();
  const [direction, setDirection] = useState<Direction>('focus');
  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get('d');
    // Reads the URL once after mount; the server render has no window.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d === 'focus' || d === 'lanes' || d === 'faces') setDirection(d);
  }, []);
  const choose = (d: Direction) => { setDirection(d); window.history.replaceState(null, '', '?d=' + d); };
  const l = derive(records);
  const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric' });
  const headline = l.yourCount === 0 ? 'You’re clear today, William' : l.yourCount === 1 ? 'One person needs you, William' : `${l.yourCount} people need you, William`;

  return (
    <div className={'td is-' + direction}>
      <aside className="td-rail">
        <a className="td-brand" href="/headquarters/directions">
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect x="2" y="2" width="11" height="11" rx="3" /><rect x="15" y="2" width="11" height="11" rx="3" opacity=".45" /><rect x="2" y="15" width="11" height="11" rx="3" opacity=".45" /><rect x="15" y="15" width="11" height="11" rx="3" /></svg>
          <span>Creator HQ</span>
        </a>
        <nav aria-label="Headquarters">
          {nav.map(({ label, icon: Icon, href }) => (
            <a key={label} href={href} aria-current={label === 'Today' ? 'page' : undefined}>
              <Icon size={20} /><span>{label}</span>
              {label === 'Today' && l.yourCount > 0 && <span className="td-nav-count">{l.yourCount}</span>}
            </a>
          ))}
        </nav>
      </aside>

      <main className="td-main">
        <header className="td-head">
          <div>
            <p className="td-meta">{date}</p>
            <h1>{state === 'ready' ? headline : 'Today'}</h1>
          </div>
          <button className="td-icon-button" onClick={() => void load()} aria-label="Refresh" title="Refresh" disabled={state === 'loading'}><RefreshCw size={18} /></button>
        </header>

        {state === 'loading' && !records.length && <p className="td-empty">Gathering today’s conversations</p>}
        {state === 'error' && <p className="td-empty">Couldn’t reach your records. Nothing was changed, try refreshing</p>}
        {records.length > 0 && (direction === 'focus' ? <Focus l={l} /> : direction === 'lanes' ? <Lanes l={l} /> : <Faces l={l} />)}
      </main>

      <div className="td-switch" role="radiogroup" aria-label="Design direction">
        {directions.map((d) => (
          <button key={d.id} role="radio" aria-checked={direction === d.id} onClick={() => choose(d.id)}>{d.label}</button>
        ))}
      </div>
    </div>
  );
}
