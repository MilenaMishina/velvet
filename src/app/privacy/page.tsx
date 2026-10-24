import type { Metadata } from 'next';

import LegalPage, { type LegalSection } from '@/components/layout/legal-page';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: 'What this site stores, what it never collects, and why.',
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'The short version',
    paragraphs: [
      'No account is required to browse. We do not ask for, store, or share your name, email, or payment details in order to watch videos. Traffic analytics are aggregate counts — the site counts how many people visited, not who they are.',
    ],
  },
  {
    heading: 'What we store',
    paragraphs: ['Two kinds of local records exist:'],
    list: [
      'An anonymous visitor identifier — a random number kept in a first-party cookie — used to count unique visitors and to count a video view at most once per day, per viewer. It contains nothing about you and cannot be linked to an identity we hold, because we hold none.',
      'A session cookie, created only if you choose to create an account for comments. It carries a signed session token, not personal data; the account itself holds a display name and email you provide.',
    ],
  },
  {
    heading: 'Third parties',
    paragraphs: [
      'Videos and posters load directly from the CDNs of the sites we index — those providers see your IP address as the referrer of the media request, exactly as they would on their own site. Advertising is served by our ad network over secured iframes and page-level scripts; ad cookies are governed by that network’s own policy.',
      'Browser fonts are self-hosted, and no script from Google or any analytics company runs on these pages.',
    ],
  },
  {
    heading: 'Your control',
    paragraphs: [
      'Clearing cookies removes the visitor identifier and any session. Deleting your account removes its profile; requests can be made through the contact page. We never sell data, because we never collect data worth selling.',
    ],
  },
];

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" sections={SECTIONS} />;
}
