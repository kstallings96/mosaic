/**
 * The animals.
 *
 * There are three, one per colour, and that is the whole point: the colour
 * and the animal are two ways of saying the same thing. A student who
 * cannot separate the teal from the pink can still separate an elephant
 * from a giraffe, and anyone who can do both has the fact twice.
 *
 * All three have to survive being one flat ink at about forty pixels, which
 * is the size of a crate on the board. That is what picked them: a mane, a
 * pair of ears with a trunk between them, and a pair of horns over a long
 * face are three silhouettes nobody confuses. A flamingo was the obvious
 * partner for the pink, and it did not survive — at this size its neck and
 * beak read as a bent arm.
 */

export const ANIMALS = ['Elephant', 'Lion', 'Giraffe'] as const;

export function animalName(index: number): string {
  return ANIMALS[index % ANIMALS.length];
}

const EYE = 'animal-eye';

/**
 * Interior detail — ear hollows, a muzzle, the edge of a beak.
 *
 * It has to be drawn in a contrasting ink rather than the body ink at low
 * opacity. Same-colour shapes stacked on a solid silhouette are invisible,
 * which is how the lion lost its mane the first time round.
 */
const CUT = 'animal-cut';

/** For marks that carry the identity on their own, like a giraffe's spots. */
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
    case 0: // elephant — big side ears and a trunk
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
    case 1: // lion — the mane is bumps, so it survives being one flat colour
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
    default: // giraffe — stub horns, side ears, spots
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
