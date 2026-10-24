import type { Metadata } from 'next';

import LegalPage, { type LegalSection } from '@/components/layout/legal-page';

export const metadata: Metadata = {
  title: 'DMCA',
  description: 'How to file a takedown notice under the DMCA, and how we respond.',
};

const DMCA_EMAIL = 'dmca@example.com'; // TODO(operator): replace with the realreports inbox before launch.

const SECTIONS: LegalSection[] = [
  {
    heading: 'Our position',
    paragraphs: [
      'This site is an index of publicly available adult content published on third-party websites. We do not host, upload, store or stream any video: every scene is played from the publisher’s own infrastructure, and every listing links to the original page. We nonetheless respond to valid DMCA notices promptly and in good faith.',
    ],
  },
  {
    heading: 'How to file a notice',
    paragraphs: [
      `Send a written notice to ${DMCA_EMAIL} with the subject line "DMCA Notice". A valid notice includes:`,
    ],
    list: [
      'identification of the copyrighted work claimed to be infringed;',
      'the exact URL(s) on this site that contain the listing(s) at issue;',
      'your full name, mailing address, telephone number and email address;',
      'a statement that you have a good-faith belief the use is not authorised by the copyright owner, its agent, or the law;',
      'a statement, under penalty of perjury, that the information in the notice is accurate and that you are the copyright owner or authorised to act on the owner’s behalf;',
      'your physical or electronic signature.',
    ],
  },
  {
    heading: 'What we do',
    paragraphs: [
      'Valid notices are actioned within a reasonable time: the affected listings are removed from the catalogue, and the source site involved is reviewed for continued indexing. Where a notice is materially incomplete we will tell you what is missing. A counter-notification procedure is available to publishers who believe material was removed in error.',
    ],
  },
  {
    heading: 'Repeat infringers',
    paragraphs: [
      'Sources that generate repeated valid takedowns are delisted from the crawler entirely — not just patched listing by listing.',
    ],
  },
];

export default function DmcaPage() {
  return <LegalPage title="DMCA notice & takedown" sections={SECTIONS} />;
}
