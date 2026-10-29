'use client';
import { useState } from 'react';
import { ArrowUpRight, Download, Upload } from 'lucide-react';
import { hqImportFileSchema, hqUpdateBatchSchema, type HqImportFile, type HqRecordEnvelope, type HqUpdateBatch } from '@/lib/hq-validation';

const playbook: { title: string; body: (string | string[])[] }[] = [
  { title: 'Route the conversation', body: [
    'Identify who the person is and what they need now. Creator, customer, trade and needs review are separate routes. A popular account or a product question alone is not a collaboration lead.',
    'Keep noncreator chats. Prepare a next step for William until the general DM response workflow is approved.',
  ] },
  { title: 'Make the next move useful', body: [
    'Read the last incoming message and your last promise. Affirm the creator’s specific design choices, connect them to their home, and add useful information. Warm and enthusiastic, without inventing familiarity.',
    'Short paragraphs with blank lines between them. Natural :) and :( or an occasional emoji fit William’s voice. On Instagram, use the verified word-joiner smile workaround; a sad emoticon currently converts to an image.',
    'Finish with the next useful question: design direction, timing, area, then sample details when ready. Don’t send every intake question at once. Verify technical product claims before recommending a specification.',
  ] },
  { title: 'Samples, scope, agreement', body: [
    'Normal route: project fit, samples when needed, final scope, agreement, main order, content. A time-sensitive creator can take an earlier agreement route, with the exception recorded.',
    'For samples, collect first and last name, a stable address, phone and email. Keep private contact details in the source thread. Record sample dispatch only with shipment evidence.',
  ] },
  { title: 'New partnership defaults', body: [
    ['One delivered unboxing within 7 days of main-product delivery. Posting optional', 'One creative video, publicly posted within 14 days of installation', 'Five delivered lifestyle photos. Posting optional', 'Raw footage scope tailored to the creator, with more leeway for established creators', 'Stories optional'],
    'Existing agreements keep their actual terms. Shipping exceptions and paid commitments need William’s approval after the agent prepares the estimate and recommendation.',
  ] },
  { title: 'Warmth is not follower count', body: [
    ['1  No meaningful response', '2  Early or stalled exchange', '3  Interest, details still open', '4  Useful two-way project discussion', '5  Agreed collaboration and confirmed next steps'],
    'Prefer LA and nearby creators when design and project fit are comparable. Local doesn’t automatically mean free delivery.',
  ] },
  { title: 'Who does what', body: [
    'Use “I’m handling this” before a manual conversation. It pauses agent messages across linked channels until you hand it back. Handing back triggers a fresh source review and keeps approval requirements.',
    'Agents review sources, classify, update context, prepare options and record the next step. They notify William only when a decision is ready.',
    'William decides commercial exceptions, adjusts tone and approves proposals that need his judgment. Approving a prepared reply lets the agent send that exact text once, after its normal checks.',
    'Done means evidence: an actual sent message, a confirmed sample handoff, accepted scope or received assets.',
  ] },
];

export function PlaybookView() {
  return (
    <div className="dk-cards">
      {playbook.map((section, i) => (
        <section key={section.title} className="dk-card">
          <h3><span className="dk-step">{i + 1}</span>{section.title}</h3>
          {section.body.map((part, j) => Array.isArray(part)
            ? <ul key={j}>{part.map((item) => <li key={item}>{item}</li>)}</ul>
            : <p key={j}>{part}</p>)}
        </section>
      ))}
    </div>
  );
}

export function SettingsView({ records, onChanged }: { records: HqRecordEnvelope[]; onChanged: () => Promise<void> }) {
  const [importBatch, setImportBatch] = useState<HqImportFile | null>(null);
  const [updateBatch, setUpdateBatch] = useState<HqUpdateBatch | null>(null);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const backup = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'headquarters-private-backup.json'; a.click();
    URL.revokeObjectURL(url);
  };

  async function readFile<T>(file: File | undefined, max: number, parse: (v: unknown) => T) {
    if (!file) return null;
    try {
      if (file.size > max) throw new Error();
      return parse(JSON.parse(await file.text()));
    } catch {
      setStatus({ tone: 'error', text: 'That file isn’t a valid reviewed file. Nothing was uploaded' });
      return null;
    }
  }

  async function addPeople() {
    if (!importBatch) return;
    setBusy(true); setStatus(null);
    let created = 0, skipped = 0;
    try {
      for (let i = 0; i < importBatch.records.length; i += 25) {
        const response = await fetch('/api/headquarters/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mutationId: importBatch.mutationId, records: importBatch.records.slice(i, i + 25) }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Import stopped');
        created += body.created; skipped += body.skipped;
      }
      setStatus({ tone: 'ok', text: `Added ${created}. ${skipped} were already here and stayed as they were` });
      setImportBatch(null);
    } catch (e) {
      setStatus({ tone: 'error', text: `${e instanceof Error ? e.message : 'Import stopped'}. ${created} were added before it stopped` });
    } finally {
      setBusy(false); await onChanged();
    }
  }

  async function applyUpdates() {
    if (!updateBatch) return;
    setBusy(true); setStatus(null);
    let count = 0;
    try {
      for (const entry of updateBatch.updates) {
        const current = records.find((r) => r.id === entry.id);
        if (!current || current.version !== entry.version) throw new Error(`Stopped at ${entry.id}: it changed since the file was made. Review it first`);
        const response = await fetch('/api/headquarters/' + encodeURIComponent(entry.id), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version: entry.version, mutationId: entry.mutationId, changes: entry.changes }) });
        const body = await response.json();
        if (!response.ok) throw new Error(`Stopped at ${entry.id}: ${body.error || 'not saved'}`);
        count++;
      }
      setStatus({ tone: 'ok', text: `Applied all ${count} updates` });
      setUpdateBatch(null);
    } catch (e) {
      setStatus({ tone: 'error', text: `${count} saved. ${e instanceof Error ? e.message : 'Stopped'}` });
    } finally {
      setBusy(false); await onChanged();
    }
  }

  return (
    <div className="dk-cards">
      {status && <p className={'dk-banner' + (status.tone === 'error' ? ' is-error' : '')} role="status">{status.text}</p>}
      <section className="dk-card">
        <h3>Access and alerts</h3>
        <p>You and approved agents sign in through your Vercel team. Anyone you add there can edit; there are no view-only roles yet.</p>
        <p>New ready decisions are emailed to your USC inbox. The overnight report adds creator next steps to your Notion daily log.</p>
        <a className="dk-link" href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">Manage team access<ArrowUpRight size={15} /></a>
      </section>
      <section className="dk-card">
        <h3>Backup</h3>
        <p>HQ keeps reviewed context and links to each conversation. Instagram, TikTok and email remain the message record. Every save is version-checked and logged.</p>
        <button className="dk-secondary" onClick={backup}><Download size={16} />Download private backup</button>
      </section>
      <section className="dk-card">
        <h3>Add reviewed people</h3>
        <p>Adds new people only. Anyone already here stays as they are.</p>
        <label className="dk-file"><Upload size={16} /><span>{importBatch ? `${importBatch.records.length} people ready` : 'Choose import file'}</span>
          <input type="file" accept="application/json,.json" onChange={async (e) => { setStatus(null); setImportBatch(await readFile(e.target.files?.[0], 5_000_000, (v) => hqImportFileSchema.parse(v))); }} />
        </label>
        {importBatch && <><p className="dk-fine">{importBatch.records.map((r) => r.data.name).join(', ')}</p><button className="dk-primary" disabled={busy} onClick={() => void addPeople()}>{busy ? 'Adding' : 'Add them'}</button></>}
      </section>
      <section className="dk-card">
        <h3>Apply reviewed updates</h3>
        <p>Agents prepare a versioned update file. If any record changed since, it stops there and keeps what already saved.</p>
        <label className="dk-file"><Upload size={16} /><span>{updateBatch ? `${updateBatch.updates.length} updates ready` : 'Choose update file'}</span>
          <input type="file" accept="application/json,.json" onChange={async (e) => { setStatus(null); setUpdateBatch(await readFile(e.target.files?.[0], 1_000_000, (v) => hqUpdateBatchSchema.parse(v))); }} />
        </label>
        {updateBatch && <button className="dk-primary" disabled={busy} onClick={() => void applyUpdates()}>{busy ? 'Applying' : `Apply ${updateBatch.updates.length} updates`}</button>}
      </section>
    </div>
  );
}
