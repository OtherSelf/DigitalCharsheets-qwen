'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/app/loading';

/**
 * Redirect page to skip choice and go straight to manual creation.
 */
export default function NewCharacterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/new/manual');
  }, [router]);

  return <Loading />;
}
