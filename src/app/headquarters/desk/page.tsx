import { redirect } from 'next/navigation';

// The desk is now the headquarters home page.
export default function DeskPage() { redirect('/headquarters'); }
