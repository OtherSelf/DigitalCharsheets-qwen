import type { Metadata } from 'next';

import { PrivacyView } from './privacy-view';

export const metadata: Metadata = {
  title: 'Privacy policy — Digital Character Sheets',
  description:
    'How this instance processes personal data: what is stored, why, for how long and how to exercise your rights.',
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
