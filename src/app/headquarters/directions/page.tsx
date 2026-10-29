import { Inter } from 'next/font/google';
import { TodayDirections } from '@/components/headquarters/today-directions';
import './directions.css';

// Local design review only: three candidate layouts for the Today page,
// fed by the same records as /headquarters. Not linked from the app.
const inter = Inter({ subsets: ['latin'], variable: '--td-font' });

export const metadata = { title: 'Today directions | HAUS', robots: { index: false, follow: false } };
export default function DirectionsPage() { return <div className={inter.variable}><TodayDirections /></div>; }
