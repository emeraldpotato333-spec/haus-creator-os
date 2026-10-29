import { Inter } from 'next/font/google';
import { CommandDesk } from '@/components/headquarters/desk/command-desk';
import './desk/base.css';
import './desk/desk.css';

const inter = Inter({ subsets: ['latin'], variable: '--td-font' });

export const metadata = { title: 'Creator HQ | HAUS', robots: { index: false, follow: false } };
export default function HeadquartersPage() { return <div className={inter.variable}><CommandDesk /></div>; }
