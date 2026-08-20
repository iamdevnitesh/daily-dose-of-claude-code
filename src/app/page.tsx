import { redirect } from 'next/navigation';
import { todayLocal } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default function Home() {
  redirect(`/day/${todayLocal()}`);
}
