import type { Metadata } from 'next';

import LegalPage, { type LegalSection } from '@/components/layout/legal-page';

export const metadata: Metadata = {
  title: '18 U.S.C. 2257',
  description: 'Record-keeping statement for 18 U.S.C. §2257 and 2257A.',
};

const SECTIONS: LegalSection[] = [
  {
    heading: 'Statement',
    paragraphs: [
      'All models, actors, actresses and other persons that appear in any visual depiction of actual or simulated sexual conduct appearing on or contained within this site were over the age of eighteen (18) years at the time of the creation of such depictions.',
    ],
  },
  {
    heading: 'Why this site is exempt',
    paragraphs: [
      'This site is not a “producer” of any depictions within the meaning of 18 U.S.C. §2257 or 28 C.F.R. §75.1(c): the operator does not produce, hire, direct or manufacture any visual depiction, and the depictions are not hosted on this site’s servers. The site acts purely as a search and discovery layer that indexes, embeds and attributes content produced and published by third parties, with each scene playing from the publisher’s own infrastructure.',
      'Accordingly, the records required by 18 U.S.C. §2257 and 28 C.F.R. §75 with respect to any depiction accessed through this site are kept by the original producer and publisher of that depiction, whose identity and custodian of records are stated at the source page linked from every listing.',
    ],
  },
  {
    heading: 'Questions',
    paragraphs: [
      'Concerns about record-keeping for a specific scene should be directed to the publisher of that scene through the original page linked on its listing, or raised with us through the contact page so the listing can be removed pending review.',
    ],
  },
];

export default function Page2257() {
  return <LegalPage title="18 U.S.C. §2257 statement" sections={SECTIONS} />;
}
