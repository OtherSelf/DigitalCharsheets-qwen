// src/app/demo/page.tsx
'use client';

import { DemoLanding } from '@/components/demo-landing';
import { GuestHeader } from '@/components/layout/guest-header';

export default function DemoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 🎯 LANDMARK: DEMO_HEADER → общая гостевая шапка с темой/языком/видом */}
      <GuestHeader showLoginLink />

      <main className="container mx-auto max-w-6xl flex-1 px-4 py-8">
        <DemoLanding createHref="/new" />
      </main>
    </div>
  );
}
