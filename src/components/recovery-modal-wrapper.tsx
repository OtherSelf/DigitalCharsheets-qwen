'use client';

import { Suspense } from 'react';
import { RecoveryModal } from './recovery-modal';

export function RecoveryModalWrapper() {
  return (
    <Suspense fallback={null}>
      <RecoveryModal />
    </Suspense>
  );
}