// Districts of Rome on the placeholder plan (1000 × 700, north up).
import type { PlaceId } from '../sim/types';

export interface PlaceDef {
  id: PlaceId;
  label: string;
  blurb: string;
  poly: number[];
  labelAt: [number, number];
}

export const PLACES: PlaceDef[] = [
  { id: 'campus', label: 'Campus Martius', blurb: 'The open plain in the river bend: elections, the army’s muster, young men exercising.', poly: [330, 40, 560, 40, 560, 250, 420, 300, 262, 300, 236, 232, 302, 122], labelAt: [420, 160] },
  { id: 'capitol', label: 'Capitol', blurb: 'The citadel and the temple of Jupiter Best and Greatest. Assemblies meet in front of it.', poly: [420, 305, 500, 292, 522, 350, 472, 392, 410, 372], labelAt: [465, 342] },
  { id: 'forum', label: 'Forum', blurb: 'Rostra, Senate house, bankers’ stalls, the courts. Where reputations are made.', poly: [512, 352, 600, 332, 642, 392, 562, 432, 502, 402], labelAt: [570, 386] },
  { id: 'palatine', label: 'Palatine', blurb: 'The best addresses in Rome. The great houses receive their clients at dawn.', poly: [482, 424, 562, 438, 592, 502, 522, 542, 462, 502], labelAt: [525, 482] },
  { id: 'boarium', label: 'Forum Boarium', blurb: 'The cattle market and river harbor. Dealers, porters, grain.', poly: [340, 402, 410, 378, 470, 402, 456, 482, 352, 472], labelAt: [404, 432] },
  { id: 'aventine', label: 'Aventine', blurb: 'The plebs’ own hill, outside the old sacred boundary. Temple of Diana, temple of Ceres.', poly: [334, 502, 452, 492, 502, 562, 452, 652, 342, 642], labelAt: [418, 572] },
  { id: 'subura', label: 'Subura', blurb: 'Crowded valley of tenements, workshops and taverns. The urban tribes live here.', poly: [592, 252, 722, 222, 762, 322, 652, 342, 612, 322], labelAt: [676, 282] },
  { id: 'carinae', label: 'Carinae', blurb: 'A respectable slope of the Esquiline. Your rented house is here.', poly: [652, 352, 772, 332, 822, 432, 702, 472, 632, 422], labelAt: [726, 400] },
];

export const TIBER: number[] = [330, -10, 300, 120, 222, 230, 210, 330, 300, 430, 330, 520, 300, 710];
