'use client';

import dynamic from 'next/dynamic';

const ManhwaStudioApp = dynamic(
  () => import('@/components/ManhwaStudioApp'),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function Home() {
  return <ManhwaStudioApp />;
}
