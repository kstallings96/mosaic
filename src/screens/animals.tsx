/**
 * The animals.
 *
 * Eleven identical circles told a student nothing about which node was
 * which, so the last level's pieces are animals with their own
 * silhouettes. Shape carries identity; colour never does. Colour on every
 * level of this app means one thing — which group a piece has been put in —
 * and an animal with a hue of its own would look like it was already
 * placed.
 */

export const ANIMALS = [
  'Lion',
  'Elephant',
  'Giraffe',
  'Zebra',
  'Monkey',
  'Bear',
  'Fox',
  'Owl',
  'Frog',
  'Hippo',
  'Rhino',
] as const;

export function animalName(index: number): string {
  return ANIMALS[index % ANIMALS.length];
}

const EYE = 'animal-eye';

/**
 * Interior detail — manes, muzzles, stripes, facial discs.
 *
 * It has to be drawn in a contrasting ink rather than the body ink at low
 * opacity. Same-colour shapes stacked on a solid silhouette are invisible,
 * which is how the lion lost its mane and the zebra lost its stripes.
 */
const CUT = 'animal-cut';

/** For marks that carry the whole identity - stripes, spots, a face patch. */
const DEEP = 'animal-cut deep';

/** A ring of bumps, for the one animal that is mostly hair. */
function mane(radius: number, count: number, bump: number) {
  return Array.from({ length: count }, (_, k) => {
    const a = (2 * Math.PI * k) / count;
    return (
      <circle key={k} cx={12 + radius * Math.cos(a)} cy={12 + radius * Math.sin(a)} r={bump} />
    );
  });
}

function Shape({ i }: { i: number }) {
  switch (i % ANIMALS.length) {
    case 0: // lion — the mane is bumps, so it survives being one flat colour
      return (
        <>
          {mane(8.6, 11, 3.1)}
          <circle cx="12" cy="12" r="7.6" />
          <circle className={CUT} cx="12" cy="12.4" r="5.6" />
          <circle className={EYE} cx="9.9" cy="11.4" r="1" />
          <circle className={EYE} cx="14.1" cy="11.4" r="1" />
          <ellipse cx="12" cy="15" rx="2.2" ry="1.5" />
        </>
      );
    case 1: // elephant — big side ears and a trunk
      return (
        <>
          <circle cx="5.6" cy="11" r="5.1" />
          <circle cx="18.4" cy="11" r="5.1" />
          <circle className={CUT} cx="5.6" cy="11" r="2.6" />
          <circle className={CUT} cx="18.4" cy="11" r="2.6" />
          <rect x="7.8" y="5.5" width="8.4" height="11" rx="4.2" />
          <path
            d="M12 15.6c0 3.4.6 5.4 2 5.4 1 0 1.5-.8 1.5-1.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle className={EYE} cx="10" cy="10.4" r="0.95" />
          <circle className={EYE} cx="14" cy="10.4" r="0.95" />
        </>
      );
    case 2: // giraffe — stub horns, side ears, spots
      return (
        <>
          <rect x="9.2" y="3.2" width="1.5" height="3" rx="0.75" />
          <circle cx="9.95" cy="2.9" r="1.7" />
          <rect x="13.3" y="3.2" width="1.5" height="3" rx="0.75" />
          <circle cx="14.05" cy="2.9" r="1.7" />
          <ellipse cx="5.9" cy="9.2" rx="2.9" ry="1.7" transform="rotate(-22 5.9 9.2)" />
          <ellipse cx="18.1" cy="9.2" rx="2.9" ry="1.7" transform="rotate(22 18.1 9.2)" />
          <ellipse cx="12" cy="13.4" rx="4.7" ry="7.4" />
          <circle className={DEEP} cx="10" cy="8.8" r="1.9" />
          <circle className={DEEP} cx="14.2" cy="10.4" r="1.6" />
          <ellipse className={CUT} cx="12" cy="18.4" rx="3.2" ry="2.4" />
          <circle className={EYE} cx="9.7" cy="13.2" r="1" />
          <circle className={EYE} cx="14.3" cy="13.2" r="1" />
        </>
      );
    case 3: // zebra — pointed ears and stripes clipped to the head
      return (
        <>
          <path d="M8.4 5.4 9.7 1.6 11.3 5.4Z" />
          <path d="M15.6 5.4 14.3 1.6 12.7 5.4Z" />
          <ellipse cx="12" cy="13.2" rx="5.1" ry="7.4" />
          <clipPath id={`zebra-${i}`}>
            <ellipse cx="12" cy="13.2" rx="5.1" ry="7.4" />
          </clipPath>
          <g className={DEEP} clipPath={`url(#zebra-${i})`}>
            <rect x="9.4" y="6.4" width="1.05" height="5" rx="0.5" transform="rotate(-8 9.9 8.9)" />
            <rect x="11.5" y="6.1" width="1.05" height="5.4" rx="0.5" />
            <rect x="13.6" y="6.4" width="1.05" height="5" rx="0.5" transform="rotate(8 14.1 8.9)" />
          </g>
          <circle className={EYE} cx="9.4" cy="13.6" r="1" />
          <circle className={EYE} cx="14.6" cy="13.6" r="1" />
          <circle className={EYE} cx="10.9" cy="18.3" r="0.8" />
          <circle className={EYE} cx="13.1" cy="18.3" r="0.8" />
        </>
      );
    case 4: // monkey — round side ears, pale muzzle
      return (
        <>
          <circle cx="4.4" cy="12" r="3.3" />
          <circle cx="19.6" cy="12" r="3.3" />
          <circle cx="12" cy="12" r="7.6" />
          <ellipse className={CUT} cx="12" cy="14.6" rx="4.6" ry="3.6" />
          <circle className={EYE} cx="9.8" cy="10.4" r="1.05" />
          <circle className={EYE} cx="14.2" cy="10.4" r="1.05" />
          <circle className={EYE} cx="10.7" cy="14.2" r="0.6" />
          <circle className={EYE} cx="13.3" cy="14.2" r="0.6" />
        </>
      );
    case 5: // bear — round ears on top
      return (
        <>
          <circle cx="6.4" cy="6.4" r="3.5" />
          <circle cx="17.6" cy="6.4" r="3.5" />
          <circle className={CUT} cx="6.4" cy="6.4" r="1.6" />
          <circle className={CUT} cx="17.6" cy="6.4" r="1.6" />
          <circle cx="12" cy="13" r="8.1" />
          <ellipse className={CUT} cx="12" cy="16.2" rx="3.6" ry="2.8" />
          <circle className={EYE} cx="9.5" cy="11.6" r="1.05" />
          <circle className={EYE} cx="14.5" cy="11.6" r="1.05" />
        </>
      );
    case 6: // fox — swept ears, tapered face, pale cheeks
      return (
        <>
          <path d="M4.6 3.6 10.4 9 6.4 11.4Z" />
          <path d="M19.4 3.6 13.6 9 17.6 11.4Z" />
          <path d="M12 21.4 4.4 9.6C8.6 6.6 15.4 6.6 19.6 9.6Z" />
          <path className={CUT} d="M12 19.6 7.6 11.2c2.8-1.4 6-1.4 8.8 0Z" />
          <circle className={EYE} cx="9.5" cy="11.4" r="1" />
          <circle className={EYE} cx="14.5" cy="11.4" r="1" />
        </>
      );
    case 7: // owl — tufts and big facial discs
      return (
        <>
          <path d="M5.6 5.4 8.4 1.8 10.6 5.6Z" />
          <path d="M18.4 5.4 15.6 1.8 13.4 5.6Z" />
          <circle cx="12" cy="13" r="8.3" />
          <circle className={CUT} cx="9.1" cy="11.6" r="3.4" />
          <circle className={CUT} cx="14.9" cy="11.6" r="3.4" />
          <circle className={EYE} cx="9.1" cy="11.6" r="1.4" />
          <circle className={EYE} cx="14.9" cy="11.6" r="1.4" />
          <path d="M12 14.6 13.6 17.4h-3.2Z" />
        </>
      );
    case 8: // frog — the eyes sit on top of the head
      return (
        <>
          <circle cx="7" cy="7.4" r="3.7" />
          <circle cx="17" cy="7.4" r="3.7" />
          <path d="M12 8.2c5.1 0 8.6 2.7 8.6 6.1 0 3.5-3.5 5.8-8.6 5.8s-8.6-2.3-8.6-5.8c0-3.4 3.5-6.1 8.6-6.1Z" />
          <circle className={EYE} cx="7" cy="7.4" r="1.6" />
          <circle className={EYE} cx="17" cy="7.4" r="1.6" />
          <rect className={DEEP} x="7.4" y="16.2" width="9.2" height="1.3" rx="0.65" />
        </>
      );
    case 9: // hippo — wide muzzle, nostrils
      return (
        <>
          <circle cx="6.8" cy="6.2" r="2.5" />
          <circle cx="17.2" cy="6.2" r="2.5" />
          <ellipse cx="12" cy="13.4" rx="8.4" ry="6.6" />
          <ellipse className={CUT} cx="12" cy="16.2" rx="5.6" ry="3.6" />
          <circle className={EYE} cx="9.2" cy="10" r="1" />
          <circle className={EYE} cx="14.8" cy="10" r="1" />
          <circle className={EYE} cx="10.2" cy="16.2" r="0.85" />
          <circle className={EYE} cx="13.8" cy="16.2" r="0.85" />
        </>
      );
    default: // rhino — one horn
      return (
        <>
          <path d="M12 2.2 14.2 8.6H9.8Z" />
          <circle cx="6.6" cy="8.4" r="2.3" />
          <circle cx="17.4" cy="8.4" r="2.3" />
          <ellipse cx="12" cy="14.2" rx="7.4" ry="6.3" />
          <ellipse className={CUT} cx="12" cy="17.2" rx="4.6" ry="2.9" />
          <circle className={EYE} cx="9.2" cy="12.4" r="1" />
          <circle className={EYE} cx="14.8" cy="12.4" r="1" />
        </>
      );
  }
}

export default function AnimalHead({ index, size = 34 }: { index: number; size?: number }) {
  return (
    <svg
      className="animal"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      overflow="visible"
    >
      <Shape i={index} />
    </svg>
  );
}
