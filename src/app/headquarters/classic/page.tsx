import { Headquarters } from '@/components/headquarters/headquarters';
import '../headquarters.css';

export const metadata = { title: 'Creator headquarters | HAUS', robots: { index: false, follow: false } };
export default function HeadquartersPage() { return <Headquarters />; }
