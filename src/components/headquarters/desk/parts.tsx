'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import type { HqRecordEnvelope } from '@/lib/hq-validation';

export const firstName = (name: string) => name.split(/[\s/&]+/)[0];
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((s) => s[0]).slice(0, 2).join('').toUpperCase();
export const safeUrl = (v?: string) => (v && /^https:\/\//.test(v) ? v : undefined);

// The records carry long, careful agent instructions. Lists only need the
// first sentence, phrased as the step itself.
export function ask(text: string, max = 120) {
  const sentence = text.replace(/^(William|Will|Creator Agent|Agent) to /i, '').split(/(?<=[.!?])\s/)[0].replace(/\.$/, '');
  const clean = sentence.charAt(0).toUpperCase() + sentence.slice(1);
  return clean.length > max ? clean.slice(0, max).replace(/\s+\S*$/, '') + '…' : clean;
}

export function todayPT() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function daysFromToday(date: string) {
  return Math.round((new Date(date + 'T12:00:00').getTime() - new Date(todayPT() + 'T12:00:00').getTime()) / 864e5);
}

export function due(date: string | null | undefined) {
  if (!date) return { text: 'No date', late: false };
  const days = daysFromToday(date);
  if (days < 0) return { text: days === -1 ? 'Since yesterday' : `${-days} days late`, late: true };
  if (days === 0) return { text: 'Today', late: false };
  if (days === 1) return { text: 'Tomorrow', late: false };
  return { text: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), late: false };
}

export function ago(iso?: string | null) {
  if (!iso) return '';
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

export function Face({ r, size = 44 }: { r: HqRecordEnvelope; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = safeUrl(r.data.profileImageUrl);
  return (
    <span className="td-face" style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {src && !failed ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : initials(r.data.name)}
    </span>
  );
}
