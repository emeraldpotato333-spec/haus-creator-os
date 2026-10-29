import { Inter } from 'next/font/google';
import { CommandDesk } from '@/components/headquarters/desk/command-desk';
import '../directions/directions.css';
import './desk.css';

// Local candidate for the new Today page. Not linked from the live app yet.
const inter = Inter({ subsets: ['latin'], variable: '--td-font' });

export const metadata = { title: 'Command desk | HAUS', robots: { index: false, follow: false } };
export default function DeskPage() { return <div className={inter.variable}><CommandDesk /></div>; }
