import { useEffect } from 'react';
import { MarketingNav } from '@/components/layout/MarketingNav';
import { Hero } from '@/components/landing/Hero';
import { Story } from '@/components/landing/Story';
import { RecordDemo, Features, Privacy, FinalCall, Footer } from '@/components/landing/Sections';
import { useForceDaylight } from '@/context/ThemeContext';
import { health } from '@/api/meetings';

export default function Landing() {
  useForceDaylight();
  useEffect(() => { document.title = 'MeetMind · Meetings that write their own minutes'; health().catch(() => {}); }, []);
  return (
    <div className="bg-canvas min-h-screen">
      <MarketingNav dark />
      <main>
        <Hero />
        <Story />
        <RecordDemo />
        <Features />
        <Privacy />
        <FinalCall />
      </main>
      <Footer />
    </div>
  );
}
