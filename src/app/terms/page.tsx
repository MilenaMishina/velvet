import type { Metadata } from 'next';

import LegalPage, { type LegalSection } from '@/components/layout/legal-page';

export const metadata: Metadata = {
  title: 'Terms of service',
  description: 'The terms that govern the use of this site.',
};

const SECTIONS: LegalSection[] = [
  {
    heading: '1. Acceptance',
    paragraphs: [
      'By accessing this site you confirm that you are at least 18 years old — or the age of majority in your jurisdiction, if higher — and that viewing adult material is legal where you are. If either is not true, you must leave now.',
      'This site is labelled with the RTA (Restricted To Adults) meta tag so parental-control and safe-search filters can block it. We expect that label to be honoured.',
    ],
  },
  {
    heading: '2. What this site is',
    paragraphs: [
      'This site is a search and discovery layer over publicly available adult content published elsewhere. We do not host, store, transmit, produce, or edit any video. Every scene plays from the publisher’s own player or CDN, exactly as their own site serves it, and every listing links to the original page.',
    ],
  },
  {
    heading: '3. Acceptable use',
    paragraphs: ['You agree not to:'],
    list: [
      'attempt to bypass age verification or access the site while underage;',
      'scrape, mirror or resell the catalogue or its metadata at scale without written permission;',
      'interfere with the service, its infrastructure, or its advertising;',
      'use the site for any unlawful purpose.',
    ],
  },
  {
    heading: '4. Content and takedowns',
    paragraphs: [
      'Copyright and removal requests are handled under our DMCA policy. We act on valid notices promptly: the affected listings are removed from the index and the source is reviewed for re-inclusion.',
    ],
  },
  {
    heading: '5. Liability',
    paragraphs: [
      'The catalogue is provided as found, without warranties of any kind. We do not control third-party sites and are not liable for their content, availability, or practices. To the maximum extent permitted by law, our liability to you is limited to zero.',
    ],
  },
  {
    heading: '6. Changes',
    paragraphs: [
      'These terms may change at any time; the version on this page is the one that applies. Continued use after a change means acceptance.',
    ],
  },
];

export default function TermsPage() {
  return <LegalPage title="Terms of service" sections={SECTIONS} />;
}
