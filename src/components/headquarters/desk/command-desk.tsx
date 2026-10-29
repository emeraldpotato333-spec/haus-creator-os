'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Columns3, Ellipsis, GraduationCap, Hand, LayoutGrid, Pencil, RefreshCw, Search, Settings2, Store, Undo2, Users, X } from 'lucide-react';
import { draftFromNotes, notesWithDraft, type HqChanges, type HqRecordEnvelope } from '@/lib/hq-validation';
import { Face, ago, ask, daysFromToday, due, firstName } from './parts';
import { PlaybookView, SettingsView } from './reference-views';

type View = 'today' | 'people' | 'pipeline' | 'others' | 'learned' | 'playbook' | 'settings' | 'more';
type Mode = { kind: 'view' } | { kind: 'edit'; field: 'nextAction' | 'draft'; text: string; why: string } | { kind: 'decline'; note: string };
type Group = { key: string; title: string; people: HqRecordEnvelope[] };

const stages = [['contacted', 'Contacted'], ['conversation', 'Talking'], ['scoping', 'Samples'], ['agreement', 'Agreement'], ['delivery', 'Delivery'], ['content', 'Content'], ['complete', 'Complete']] as const;
const waitingLabel: Record<string, string> = { haus: 'HAUS', creator: 'Their reply', william: 'You', none: 'Nobody' };
const nonCreator = (r: HqRecordEnvelope) => ['customer', 'trade', 'other'].includes(r.data.relationshipType);
const byDue = (a: HqRecordEnvelope, b: HqRecordEnvelope) => (a.data.dueDate ?? '9999').localeCompare(b.data.dueDate ?? '9999');

// Queue rules match headquarters.tsx; non-creator relationships get their own view.
function deskLists(records: HqRecordEnvelope[]) {
  const live = records.filter((r) => r.data.stage !== 'archived' && r.data.queueCategory !== 'research');
  const active = live.filter((r) => !r.data.needsReconciliation);
  const creators = active.filter((r) => !nonCreator(r));
  const others = active.filter(nonCreator).sort(byDue);
  const ready = creators.filter((r) => r.data.decisionStatus === 'ready').sort(byDue);
  const queue = creators.filter((r) => r.data.waitingOn !== 'creator' && r.data.taskState !== 'done' && r.data.decisionStatus !== 'ready').sort(byDue);
  const yours = queue.filter((r) => r.data.waitingOn === 'william' || r.data.owner === 'William');
  const agents = queue.filter((r) => !yours.includes(r));
  const waiting = creators.filter((r) => r.data.waitingOn === 'creator').sort(byDue);
  const backlog = live.filter((r) => r.data.needsReconciliation);

  const late = (r: HqRecordEnvelope) => Boolean(r.data.dueDate && daysFromToday(r.data.dueDate) < 0);
  const hoursSince = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : 0);
  const slipping: Group[] = [
    { key: 'overdue', title: 'Past their review date', people: [...ready, ...queue].filter(late) },
    { key: 'unanswered', title: 'Replied over a day ago', people: creators.filter((r) => r.data.lastMessageDirection === 'inbound' && r.data.waitingOn !== 'creator' && hoursSince(r.data.lastMessageAt) > 24) },
    { key: 'held', title: 'You’ve held 3+ days', people: creators.filter((r) => r.data.humanTakeover && hoursSince(r.data.humanTakeoverAt) > 72) },
    { key: 'quiet', title: 'Follow-up check is due', people: waiting.filter(late) },
    { key: 'undated', title: 'No review date set', people: queue.filter((r) => !r.data.dueDate) },
  ].filter((g) => g.people.length);

  const creatorPipeline = live.filter((r) => !nonCreator(r) && r.data.relationshipType === 'creator');
  const pipeline = stages.map(([id, label]) => ({ id, label, count: creatorPipeline.filter((r) => r.data.stage === id).length }));

  // Agent check-ins come from dated source observations on each record.
  const checks = records.flatMap((r) => (r.data.evidence ?? []).map((e) => ({ day: String(e.observedAt).slice(0, 10), id: r.id })));
  const lastDay = checks.map((c) => c.day).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1);
  const lastChecks = checks.filter((c) => c.day === lastDay);
  const activity = { lastDay, checks: lastChecks.length, people: new Set(lastChecks.map((c) => c.id)).size, preparing: creators.filter((r) => r.data.decisionStatus === 'requested').length };

  const learned = records.flatMap((r) => (r.data.williamEdits ?? []).map((edit) => ({ r, edit }))).sort((a, b) => b.edit.at.localeCompare(a.edit.at));
  return { ready, yours, agents, waiting, backlog, others, slipping, pipeline, activity, learned };
}
type Lists = ReturnType<typeof deskLists>;

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
  return { records, setRecords, state, load };
}

function QueueRow({ r, selected, onPick, showDue = true }: { r: HqRecordEnvelope; selected: boolean; onPick: (r: HqRecordEnvelope) => void; showDue?: boolean }) {
  const d = due(r.data.dueDate);
  return (
    <button className={'dk-row' + (selected ? ' is-selected' : '')} aria-current={selected || undefined} onClick={() => onPick(r)}>
      <Face r={r} size={40} />
      <span className="dk-row-text"><strong>{r.data.name}</strong><span>{ask(r.data.decisionStatus === 'ready' ? r.data.decisionReason || r.data.nextAction : r.data.nextAction, 90)}</span></span>
      {showDue && <span className={'td-due' + (d.late ? ' is-late' : '')}>{d.text}</span>}
    </button>
  );
}

function FaceRow({ people, onPick, max = 14 }: { people: HqRecordEnvelope[]; onPick: (r: HqRecordEnvelope) => void; max?: number }) {
  return (
    <div className="dk-faces">
      {people.slice(0, max).map((r) => (
        <button key={r.id} className="dk-face" onClick={() => onPick(r)} title={r.data.name}><Face r={r} size={44} /><span>{firstName(r.data.name)}</span></button>
      ))}
      {people.length > max && <a className="dk-face dk-more" href="/headquarters?view=people"><span className="td-face" style={{ width: 44, height: 44 }}>+{people.length - max}</span><span>More</span></a>}
    </div>
  );
}

function Workspace({ r, mode, setMode, saving, stale, onSave, onClose, backLabel }: {
  r: HqRecordEnvelope; mode: Mode; setMode: (m: Mode) => void; saving: boolean; stale: boolean;
  onSave: (changes: HqChanges, done?: string) => Promise<boolean>; onClose: () => void; backLabel: string;
}) {
  const d = r.data;
  const draft = draftFromNotes(d.notes);
  const isDecision = d.decisionStatus === 'ready';
  // A hold or a pending source recheck comes before any approval.
  const canDecide = isDecision && !d.humanTakeover && !d.needsReconciliation;
  const theAsk = isDecision ? d.decisionReason || d.nextAction : d.nextAction;
  const facts = [['Project', d.project], ['Timing', d.timing], ['Samples', d.sampleStatus], ['Agreement', d.agreementStatus], ['Shipping', d.shippingStatus]].filter(([, v]) => v);
  const edits = [...(d.williamEdits ?? [])].reverse();
  const editing = mode.kind === 'edit' ? mode : null;

  const saveEdit = async () => {
    if (!editing) return;
    const before = editing.field === 'draft' ? draft : d.nextAction;
    const teach = { kind: editing.field, before, after: editing.text, ...(editing.why.trim() ? { why: editing.why.trim() } : {}) };
    const changes: HqChanges = editing.field === 'draft' ? { notes: notesWithDraft(d.notes, editing.text), teach } : { nextAction: editing.text.trim(), teach };
    if (await onSave(changes, 'Saved. Agents will use your version and learn from it')) setMode({ kind: 'view' });
  };

  return (
    <article className="dk-work" aria-label={d.name}>
      <header className="dk-work-head">
        <button className="dk-back" onClick={onClose}><ChevronLeft size={20} />{backLabel}</button>
        <button className="dk-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <Face r={r} size={64} />
        <div className="dk-work-id">
          <h2>{d.name}</h2>
          <p>{d.handle}</p>
        </div>
        <div className="dk-work-links">
          {(d.channels ?? []).slice(0, 3).map((c) => <a key={c.url} className="dk-link" href={c.url} target="_blank" rel="noreferrer">{c.platform === 'Other' ? c.label : c.platform}<ArrowUpRight size={15} /></a>)}
        </div>
      </header>

      <dl className="dk-status">
        <div><dt>Owner</dt><dd>{d.humanTakeover ? 'You' : d.owner}</dd></div>
        <div><dt>Waiting on</dt><dd>{waitingLabel[d.waitingOn]}</dd></div>
        <div><dt>Review</dt><dd className={due(d.dueDate).late ? 'is-late' : ''}>{due(d.dueDate).text}</dd></div>
        <div><dt>Stage</dt><dd>{d.stage === 'archived' ? 'Archived' : (
          <select className="dk-stage" value={d.stage} disabled={saving || stale} aria-label="Stage" onChange={(e) => void onSave({ stage: e.target.value as HqChanges['stage'] }, 'Stage updated')}>
            {stages.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        )}</dd></div>
      </dl>

      {stale && <p className="dk-alert">This record changed elsewhere. Refresh before editing</p>}
      {d.needsReconciliation && <p className="dk-alert">Agents need to recheck the latest messages here before anyone replies</p>}

      <section className={'dk-ask' + (isDecision ? ' is-decision' : '')}>
        <header>
          <span className={'td-chip' + (isDecision ? ' is-ink' : '')}>{isDecision ? 'Decision ready' : d.humanTakeover ? 'You’re handling this' : d.owner === 'William' || d.waitingOn === 'william' ? 'Your turn' : `${d.owner} is on it`}</span>
          {!editing && <button className="dk-text-button" disabled={saving || stale} onClick={() => setMode({ kind: 'edit', field: 'nextAction', text: d.nextAction, why: '' })}><Pencil size={15} />Edit next step</button>}
        </header>
        {editing?.field === 'nextAction' ? null : <p className="dk-ask-text">{theAsk}</p>}
        {isDecision && d.nextAction !== theAsk && !editing && <p className="dk-ask-sub">Next step after you decide: {d.nextAction}</p>}
      </section>

      {draft && editing?.field !== 'draft' && (
        <section className="dk-draft">
          <header><h3>Prepared reply</h3><span className="td-count">Not sent</span>
            <button className="dk-text-button" disabled={saving || stale} onClick={() => setMode({ kind: 'edit', field: 'draft', text: draft, why: '' })}><Pencil size={15} />Edit reply</button>
          </header>
          <p>{draft}</p>
        </section>
      )}

      {editing && (
        <section className="dk-edit">
          <label>
            <span>{editing.field === 'draft' ? 'Your version of the reply' : 'Your version of the next step'}</span>
            <textarea value={editing.text} rows={editing.field === 'draft' ? 7 : 4} autoFocus onChange={(e) => setMode({ ...editing, text: e.target.value })} />
          </label>
          <label>
            <span>What should the agents learn from this? <em>Optional</em></span>
            <input value={editing.why} placeholder="Shorter, lead with their project, skip the pricing for now" onChange={(e) => setMode({ ...editing, why: e.target.value })} />
          </label>
          <p className="dk-fine">Agents keep this conversation. Saving doesn’t send anything</p>
          <div className="dk-actions">
            <button className="dk-primary" disabled={saving || !editing.text.trim()} onClick={() => void saveEdit()}>{saving ? 'Saving' : 'Save my version'}</button>
            <button className="dk-secondary" disabled={saving} onClick={() => setMode({ kind: 'view' })}>Cancel</button>
          </div>
        </section>
      )}

      {mode.kind === 'decline' && (
        <section className="dk-edit">
          <label>
            <span>Why not? Agents will use this next time <em>Optional</em></span>
            <input autoFocus value={mode.note} placeholder="Not a fit for the November push" onChange={(e) => setMode({ kind: 'decline', note: e.target.value })} />
          </label>
          <div className="dk-actions">
            <button className="dk-primary" disabled={saving} onClick={async () => { if (await onSave({ verdict: { verdict: 'declined', ...(mode.note.trim() ? { note: mode.note.trim() } : {}) } }, 'Declined. The agents have your reason')) setMode({ kind: 'view' }); }}>Decline</button>
            <button className="dk-secondary" disabled={saving} onClick={() => setMode({ kind: 'view' })}>Keep it open</button>
          </div>
        </section>
      )}

      {mode.kind === 'view' && (
        <div className="dk-actions">
          {canDecide && <button className="dk-primary" disabled={saving || stale} onClick={() => void onSave({ verdict: { verdict: 'approved' } }, `Approved. ${d.owner} picks it up next run`)}><Check size={17} />{draft ? 'Approve reply' : 'Approve'}</button>}
          {canDecide && <button className="dk-secondary" disabled={saving || stale} onClick={() => setMode({ kind: 'decline', note: '' })}>Decline</button>}
          <button className="dk-secondary" disabled={saving || stale} onClick={() => void onSave({ takeover: d.humanTakeover ? 'release' : 'claim' }, d.humanTakeover ? 'Handed back. Agents recheck the thread first' : 'It’s yours. Agent messages are paused')}>
            {d.humanTakeover ? <><Undo2 size={16} />Return to agents</> : <><Hand size={16} />I’m handling this</>}
          </button>
        </div>
      )}

      <section className="dk-context">
        <h3>What’s happened</h3>
        <p>{d.summary}</p>
        {d.latestMessage && d.lastMessageDirection && d.lastMessageDirection !== 'unknown' && (
          <blockquote className={'dk-bubble' + (d.lastMessageDirection === 'outbound' ? ' is-out' : '')}>
            <p>{d.latestMessage}</p>
            <footer>{d.lastMessageDirection === 'outbound' ? 'HAUS' : firstName(d.name)} wrote {ago(d.lastMessageAt)}</footer>
          </blockquote>
        )}
        {facts.length > 0 && <dl className="dk-facts">{facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
      </section>

      {edits.length > 0 && (
        <section className="dk-context">
          <h3>What you’ve taught agents here</h3>
          {edits.slice(0, 3).map((e) => <p key={e.id} className="dk-lesson">{e.why || ask(e.after, 100)} <span>{ago(e.at)}</span></p>)}
        </section>
      )}
      {(d.evidence?.length ?? 0) > 0 && (
        <details className="dk-more-info">
          <summary>Source history <span className="td-count">{d.evidence!.length}</span></summary>
          {[...d.evidence!].reverse().map((e, i) => (
            <div key={e.id ?? i} className="dk-source">
              <p><strong>{e.label}</strong> <span>{String(e.observedAt).slice(0, 10)}</span></p>
              <p>{e.note}</p>
              {e.url && <a className="dk-text-button" href={e.url} target="_blank" rel="noreferrer">Open source<ArrowUpRight size={14} /></a>}
            </div>
          ))}
        </details>
      )}
      {d.notes && !draft && (
        <details className="dk-more-info">
          <summary>Working notes</summary>
          <p className="dk-notes">{d.notes}</p>
        </details>
      )}
    </article>
  );
}

const peopleFilters = [
  { id: 'active', label: 'Active' },
  { id: 'waiting', label: 'Waiting on them' },
  { id: 'held', label: 'You’re handling' },
  { id: 'recheck', label: 'Needs a recheck' },
  { id: 'research', label: 'Research' },
  { id: 'archived', label: 'Archived' },
] as const;
type PeopleFilter = (typeof peopleFilters)[number]['id'];

function peopleFor(records: HqRecordEnvelope[], filter: PeopleFilter, text: string) {
  const live = (r: HqRecordEnvelope) => r.data.stage !== 'archived' && r.data.queueCategory !== 'research';
  const match: Record<PeopleFilter, (r: HqRecordEnvelope) => boolean> = {
    active: (r) => live(r) && !nonCreator(r) && !r.data.needsReconciliation,
    waiting: (r) => live(r) && !nonCreator(r) && r.data.waitingOn === 'creator',
    held: (r) => live(r) && r.data.humanTakeover,
    recheck: (r) => live(r) && r.data.needsReconciliation,
    research: (r) => r.data.queueCategory === 'research',
    archived: (r) => r.data.stage === 'archived' && r.data.queueCategory !== 'research',
  };
  const q = text.trim().toLowerCase();
  return records
    .filter((r) => match[filter](r) && (!q || `${r.data.name} ${r.data.handle} ${r.data.project ?? ''}`.toLowerCase().includes(q)))
    .sort((a, b) => a.data.queuePriority - b.data.queuePriority || (b.data.warmth ?? 0) - (a.data.warmth ?? 0) || a.data.name.localeCompare(b.data.name));
}

function PipelineBoard({ records, selectedId, onPick }: { records: HqRecordEnvelope[]; selectedId?: string; onPick: (r: HqRecordEnvelope) => void }) {
  const creators = records.filter((r) => r.data.stage !== 'archived' && r.data.queueCategory !== 'research' && r.data.relationshipType === 'creator');
  return (
    <div className="dk-board">
      {stages.map(([id, label]) => {
        const people = creators.filter((r) => r.data.stage === id).sort(byDue);
        return (
          <section key={id} className={'dk-column' + (id === 'content' || id === 'complete' ? ' is-goal' : '')}>
            <header><h3>{label}</h3><span className="td-count">{people.length}</span></header>
            <div className="dk-column-cards">
              {people.map((r) => (
                <button key={r.id} className={'dk-mini' + (selectedId === r.id ? ' is-selected' : '')} onClick={() => onPick(r)}>
                  <Face r={r} size={32} />
                  <span><strong>{r.data.name}</strong><span className={due(r.data.dueDate).late ? 'is-late' : ''}>{r.data.waitingOn === 'creator' ? 'Their turn' : due(r.data.dueDate).text}</span></span>
                </button>
              ))}
              {!people.length && <p className="dk-none">No one here yet</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function CommandDesk() {
  const { records, setRecords, state, load } = useRecords();
  const [view, setView] = useState<View>('today');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [focusGroup, setFocusGroup] = useState<Group | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: 'view' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [stale, setStale] = useState(false);
  const [peopleFilter, setPeopleFilter] = useState<PeopleFilter>('active');
  const [peopleText, setPeopleText] = useState('');
  const busy = useRef(false);
  const l: Lists = useMemo(() => deskLists(records), [records]);
  const people = useMemo(() => peopleFor(records, peopleFilter, peopleText), [records, peopleFilter, peopleText]);

  const hasPane = view === 'today' || view === 'people' || view === 'others' || view === 'pipeline';
  const fallback = view === 'others' ? l.others[0] : view === 'people' ? people[0] : view === 'today' ? l.ready[0] ?? l.yours[0] : undefined;
  const selected = records.find((r) => r.id === selectedId) ?? fallback ?? null;

  const pick = (r: HqRecordEnvelope) => {
    if (busy.current) return;
    setSelectedId(r.id); setMode({ kind: 'view' }); setStale(false); setSheet(true); setQuery(''); setMessage(null);
    if (!hasPane) setView('people');
  };

  async function save(changes: HqChanges, done = 'Saved') {
    if (!selected || busy.current) return false;
    busy.current = true; setSaving(true); setMessage(null);
    try {
      const response = await fetch('/api/headquarters/' + encodeURIComponent(selected.id), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: selected.version, mutationId: crypto.randomUUID(), changes }),
      });
      const body = await response.json();
      if (response.status === 409) {
        if (body.current) setRecords((all) => all.map((x) => (x.id === selected.id ? body.current : x)));
        setStale(true);
        throw new Error('Someone updated this record first. Your change wasn’t saved, review the latest version');
      }
      if (!response.ok) throw new Error(body.error || 'That didn’t save. Nothing was changed');
      setRecords((all) => all.map((x) => (x.id === selected.id ? body.record : x)));
      setSelectedId(selected.id);
      setMessage({ tone: 'ok', text: done });
      return true;
    } catch (e) {
      setMessage({ tone: 'error', text: e instanceof Error ? e.message : 'That didn’t save' });
      return false;
    } finally {
      busy.current = false; setSaving(false);
    }
  }

  const forget = async (r: HqRecordEnvelope, id: string) => {
    const response = await fetch('/api/headquarters/' + encodeURIComponent(r.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: r.version, mutationId: crypto.randomUUID(), changes: { forgetEdit: id } }) });
    const body = await response.json();
    if (response.ok) setRecords((all) => all.map((x) => (x.id === r.id ? body.record : x)));
    else setMessage({ tone: 'error', text: 'Couldn’t remove that lesson. Refresh and try again' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSheet(false); setFocusGroup(null); setQuery(''); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const found = query.trim().length > 1 ? records.filter((r) => `${r.data.name} ${r.data.handle}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8) : [];
  const yourCount = l.ready.length + l.yours.length;
  const go = (v: View, filter?: PeopleFilter) => { setView(v); setSelectedId(null); setFocusGroup(null); setMode({ kind: 'view' }); setSheet(false); if (filter) setPeopleFilter(filter); window.scrollTo({ top: 0 }); };
  const nav: { id: View; label: string; icon: typeof Users; count?: number; quiet?: boolean; where: 'both' | 'desk' | 'phone' }[] = [
    { id: 'today', label: 'Today', icon: LayoutGrid, count: yourCount, where: 'both' },
    { id: 'people', label: 'People', icon: Users, where: 'both' },
    { id: 'pipeline', label: 'Pipeline', icon: Columns3, where: 'both' },
    { id: 'others', label: 'Customers', icon: Store, count: l.others.length, quiet: true, where: 'both' },
    { id: 'learned', label: 'Learned', icon: GraduationCap, where: 'desk' },
    { id: 'playbook', label: 'Playbook', icon: BookOpen, where: 'desk' },
    { id: 'settings', label: 'Settings', icon: Settings2, where: 'desk' },
    { id: 'more', label: 'More', icon: Ellipsis, where: 'phone' },
  ];
  const titles: Record<View, string> = {
    today: yourCount === 0 ? 'You’re clear, William' : yourCount === 1 ? 'One person needs you, William' : `${yourCount} people need you, William`,
    people: 'People', pipeline: 'Pipeline', others: 'Customers and trade', learned: 'What agents learned from you', playbook: 'Playbook', settings: 'Settings', more: 'More',
  };
  const date = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', month: 'long', day: 'numeric' });
  const backLabel = titles[view].startsWith('One') || view === 'today' ? 'Today' : titles[view];

  const queueGroups: Group[] = focusGroup ? [focusGroup] : view === 'others' ? [{ key: 'others', title: 'Active conversations', people: l.others }] : [
    { key: 'ready', title: 'Decisions', people: l.ready },
    { key: 'yours', title: 'Your turn', people: l.yours },
  ];

  const pane = (
    <div className={'dk-pane' + (sheet ? ' is-open' : '') + (view === 'pipeline' ? ' is-drawer' : '')}>
      {selected ? <Workspace key={selected.id} r={selected} mode={mode} setMode={setMode} saving={saving} stale={stale} onSave={save} onClose={() => { setSheet(false); if (view === 'pipeline') setSelectedId(null); }} backLabel={backLabel} />
        : <div className="dk-work dk-empty-pane"><h2>{view === 'people' ? 'No one matches' : 'You’re all caught up'}</h2><p>Pick anyone to see where things stand</p></div>}
    </div>
  );

  return (
    <div className="td dk">
      <aside className="td-rail">
        <button className="td-brand" onClick={() => go('today')}>
          <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><rect x="2" y="2" width="11" height="11" rx="3" /><rect x="15" y="2" width="11" height="11" rx="3" opacity=".45" /><rect x="2" y="15" width="11" height="11" rx="3" opacity=".45" /><rect x="15" y="15" width="11" height="11" rx="3" /></svg>
          <span>Creator HQ</span>
        </button>
        <nav aria-label="Headquarters">
          {nav.map(({ id, label, icon: Icon, count, quiet, where }) => {
            const current = view === id || (id === 'more' && ['learned', 'playbook', 'settings'].includes(view));
            return (
              <button key={id} onClick={() => go(id)} aria-current={current ? 'page' : undefined} className={where === 'desk' ? 'dk-desk-only' : where === 'phone' ? 'dk-phone-only' : undefined}>
                <Icon size={20} /><span>{label}</span>{Boolean(count) && <span className={'td-nav-count' + (quiet ? ' is-quiet' : '')}>{count}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="td-main dk-main">
        <header className="dk-head">
          <div>
            {view === 'today' && <p className="td-meta">{date}</p>}
            <h1>{records.length ? titles[view] : 'Today'}</h1>
          </div>
          <div className="dk-search">
            <Search size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find anyone" aria-label="Find a person" />
            {found.length > 0 && (
              <div className="dk-search-results" role="listbox">
                {found.map((r) => <button key={r.id} role="option" aria-selected={false} onClick={() => pick(r)}><Face r={r} size={32} /><span><strong>{r.data.name}</strong><span>{r.data.handle}</span></span></button>)}
              </div>
            )}
            {query.trim().length > 1 && !found.length && <div className="dk-search-results"><p className="td-empty">No one by that name yet</p></div>}
          </div>
          <button className="td-icon-button" onClick={() => void load()} aria-label="Refresh" title="Refresh" disabled={state === 'loading'}><RefreshCw size={18} /></button>
        </header>

        {message && <p className={'dk-toast' + (message.tone === 'error' ? ' is-error' : '')} role="status">{message.text}<button onClick={() => setMessage(null)} aria-label="Dismiss"><X size={16} /></button></p>}
        {state === 'loading' && !records.length && <p className="td-empty">Gathering today’s conversations</p>}
        {state === 'error' && !records.length && <p className="td-empty">Couldn’t reach your records. Nothing was changed, try refreshing</p>}

        {records.length > 0 && view === 'today' && (
          <section className={'dk-slip' + (l.slipping.length ? '' : ' is-clear')} aria-label="Slipping">
            {l.slipping.length ? l.slipping.map((g) => (
              <button key={g.key} className={'dk-slip-card' + (focusGroup?.key === g.key ? ' is-active' : '')} onClick={() => { setFocusGroup(focusGroup?.key === g.key ? null : g); pick(g.people[0]); }}>
                <strong>{g.people.length}</strong>
                <span>{g.title}</span>
                <span className="dk-slip-faces">{g.people.slice(0, 4).map((r) => <Face key={r.id} r={r} size={28} />)}</span>
              </button>
            )) : <p><Check size={18} />Nothing is slipping. Every conversation has an owner and a date</p>}
          </section>
        )}

        {records.length > 0 && (view === 'today' || view === 'others') && (
          <div className="dk-desk is-queue">
            <div className="dk-queue">
              {queueGroups.map((g) => (
                <section key={g.key}>
                  <header className="td-section">
                    <h3>{g.title}</h3><span className="td-count">{g.people.length}</span>
                    {focusGroup && <button className="dk-text-button dk-clear" onClick={() => setFocusGroup(null)}><X size={15} />Back to today</button>}
                  </header>
                  {g.people.length ? <div className="dk-list">{g.people.map((r) => <QueueRow key={r.id} r={r} selected={selected?.id === r.id} onPick={pick} />)}</div>
                    : <p className="dk-none">{g.key === 'ready' ? 'No decisions waiting' : 'Nothing else on you'}</p>}
                </section>
              ))}
              {view === 'today' && !focusGroup && l.backlog.length > 0 && (
                <button className="td-backlog" onClick={() => go('people', 'recheck')}><span><strong>{l.backlog.length} older threads</strong> need a source check</span><ChevronRight size={18} /></button>
              )}
              {view === 'today' && !focusGroup && (
                <section className="dk-panel">
                  <header className="td-section"><h3>Agents</h3></header>
                  <div className="dk-stats">
                    <div><strong>{l.activity.checks}</strong><span>source checks {l.activity.lastDay ? 'on ' + new Date(l.activity.lastDay + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}, across {l.activity.people} people</span></div>
                    <div><strong>{l.activity.preparing}</strong><span>decisions being prepared for you</span></div>
                    <div className="is-sample"><strong>3 of 5</strong><span>new first contacts today</span><em>Sample until agents log runs here</em></div>
                  </div>
                  <h4>Working on</h4>
                  <FaceRow people={l.agents} onPick={pick} />
                  <h4>Waiting on their reply</h4>
                  <FaceRow people={l.waiting} onPick={pick} />
                </section>
              )}
            </div>
            {pane}
          </div>
        )}

        {records.length > 0 && view === 'today' && (
          <section className="dk-panel dk-lower">
            <header className="td-section"><h3>Is outreach working</h3><button className="dk-text-button" onClick={() => go('pipeline')}>Open pipeline<ChevronRight size={16} /></button></header>
            <div className="dk-pipe">
              {l.pipeline.map((s) => (
                <button key={s.id} onClick={() => go('pipeline')} className={'dk-pipe-step' + (s.id === 'content' || s.id === 'complete' ? ' is-goal' : '')}>
                  <strong>{s.count}</strong><span>{s.label}</span>
                </button>
              ))}
            </div>
            <p className="dk-fine">Creator relationships by stage. Content and Complete are the goal</p>
          </section>
        )}

        {records.length > 0 && view === 'people' && (
          <div className="dk-desk">
            <div className="dk-queue">
              <div className="dk-chips" role="tablist" aria-label="Show">
                {peopleFilters.map((f) => <button key={f.id} role="tab" aria-selected={peopleFilter === f.id} onClick={() => { setPeopleFilter(f.id); setSelectedId(null); }}>{f.label}</button>)}
              </div>
              <label className="dk-search dk-filter"><Search size={16} /><input value={peopleText} onChange={(e) => setPeopleText(e.target.value)} placeholder="Filter by name or project" /></label>
              <section>
                <header className="td-section"><h3>{peopleFilters.find((f) => f.id === peopleFilter)?.label}</h3><span className="td-count">{people.length}</span></header>
                {people.length ? <div className="dk-list">{people.map((r) => <QueueRow key={r.id} r={r} selected={selected?.id === r.id} onPick={pick} showDue={peopleFilter !== 'archived' && peopleFilter !== 'research'} />)}</div> : <p className="dk-none">No one here</p>}
              </section>
            </div>
            {pane}
          </div>
        )}

        {records.length > 0 && view === 'pipeline' && (
          <>
            <p className="dk-lead">Creator relationships by stage. Open anyone to move them; moving a card never sends a message or confirms an agreement.</p>
            <PipelineBoard records={records} selectedId={sheet ? selected?.id : undefined} onPick={pick} />
            {sheet && selected && <button className="dk-scrim" aria-label="Close" onClick={() => { setSheet(false); setSelectedId(null); }} />}
            {pane}
          </>
        )}

        {records.length > 0 && view === 'learned' && (
          <section className="dk-learned">
            <p className="dk-lead">Each time you edit a reply or a next step, the change is saved here. Agents read these before writing, so remove anything you don’t want repeated.</p>
            {l.learned.length ? l.learned.map(({ r, edit }) => (
              <article key={r.id + edit.id} className="dk-lesson-card">
                <button className="dk-lesson-who" onClick={() => pick(r)}><Face r={r} size={36} /><strong>{r.data.name}</strong><span>{edit.kind === 'draft' ? 'Reply' : edit.kind === 'nextAction' ? 'Next step' : 'Decision'} edited {ago(edit.at)}</span></button>
                {edit.why && <p className="dk-lesson-why">{edit.why}</p>}
                <div className="dk-diff"><p className="is-before">{edit.before}</p><p>{edit.after}</p></div>
                <button className="dk-text-button" onClick={() => void forget(r, edit.id)}><X size={15} />Forget this</button>
              </article>
            )) : <p className="dk-none">Nothing yet. Edit a prepared reply or next step and it shows up here</p>}
          </section>
        )}

        {records.length > 0 && view === 'playbook' && <PlaybookView />}
        {records.length > 0 && view === 'settings' && <SettingsView records={records} onChanged={load} />}
        {view === 'more' && (
          <div className="dk-list dk-more-list">
            {([['learned', 'Learned', GraduationCap], ['playbook', 'Playbook', BookOpen], ['settings', 'Settings', Settings2]] as const).map(([id, label, Icon]) => (
              <button key={id} className="dk-row" onClick={() => go(id)}><Icon size={20} /><span className="dk-row-text"><strong>{label}</strong></span><ChevronRight size={18} /></button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
