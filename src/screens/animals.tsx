/**
 * The animals.
 *
 * There are three, one per colour, and that is the whole point: the colour
 * and the animal are two ways of saying the same thing. A student who
 * cannot separate the teal from the pink can still separate an elephant
 * from a giraffe, and anyone who can do both has the fact twice.
 *
 * They are drawn in two inks, dark and pale, and the pale one does most of
 * the work. A one-ink silhouette is a blob at this size no matter how good
 * its outline is: what makes a shape read as a face is an eye with a pupil
 * in it, an ear with a hollow, a muzzle that is a different colour from the
 * head. So every animal is dark body, pale patch, dark feature drawn back
 * on top of the pale — three layers, which is how a flat animal icon has
 * always been built.
 */

export const ANIMALS = ['Elephant', 'Lion', 'Giraffe'] as const;

export function animalName(index: number): string {
  return ANIMALS[index % ANIMALS.length];
}

/** Inner ears, muzzles, spots, tusks, and the whites of eyes. */
const PALE = 'animal-pale';
/** A stroked pale line — tusks, mostly. */
const PALE_LINE = 'animal-pale-line';
/** A stroked dark line — the lion's mouth, the elephant's trunk. */
const LINE = 'animal-line';

/** A ring of bumps, for the one animal that is mostly hair. */
function mane(radius: number, count: number, bump: number) {
  return Array.from({ length: count }, (_, k) => {
    const a = (2 * Math.PI * k) / count;
    return (
      <circle key={k} cx={12 + radius * Math.cos(a)} cy={12 + radius * Math.sin(a)} r={bump} />
    );
  });
}

/** A pale eye with a dark pupil. The single biggest reason a shape reads as alive. */
function eyes(x: number, y: number, r: number, pupil: number) {
  return (
    <>
      <circle className={PALE} cx={12 - x} cy={y} r={r} />
      <circle className={PALE} cx={12 + x} cy={y} r={r} />
      <circle cx={12 - x + 0.15} cy={y + 0.1} r={pupil} />
      <circle cx={12 + x - 0.15} cy={y + 0.1} r={pupil} />
    </>
  );
}

function Shape({ i }: { i: number }) {
  switch (i % ANIMALS.length) {
    case 0: // elephant — ears with hollows, tusks either side of the trunk
      return (
        <>
          <circle cx="5" cy="10.2" r="5.5" />
          <circle cx="19" cy="10.2" r="5.5" />
          {/* Offset inward and taller than they are wide, so they read as
              ear hollows. Two pale circles centred in the ears read as a
              second pair of eyes. */}
          <ellipse className={PALE} cx="6" cy="10.8" rx="2.3" ry="3" />
          <ellipse className={PALE} cx="18" cy="10.8" rx="2.3" ry="3" />
          <rect x="7.3" y="4.4" width="9.4" height="11.8" rx="4.7" />
          <path
            className={PALE_LINE}
            d="M9.7 15.2c-.4 1.6-.4 2.8 0 3.8"
            strokeWidth="1.5"
          />
          <path
            className={PALE_LINE}
            d="M14.3 15.2c.4 1.6.4 2.8 0 3.8"
            strokeWidth="1.5"
          />
          <path className={LINE} d="M12 15v3.6c0 1.9 1 2.9 2.3 2.9" strokeWidth="2.4" />
          {eyes(2.1, 9.8, 1.5, 0.8)}
        </>
      );
    case 1: // lion — pale face inside the mane, with a nose and a mouth on it
      return (
        <>
          {mane(8.5, 12, 3.2)}
          <circle cx="12" cy="12" r="7.4" />
          <circle className={PALE} cx="12" cy="12.4" r="5.5" />
          {eyes(2.2, 11, 1.25, 0.72)}
          <path d="M12 13.1 13.35 14.35h-2.7Z" />
          <path
            className={LINE}
            d="M12 14.4v1.1M12 15.5c-.55.85-1.75.85-2.25.05M12 15.5c.55.85 1.75.85 2.25.05"
            strokeWidth="0.85"
          />
        </>
      );
    default: // giraffe — ossicones, side ears, spots, and a pale muzzle
      return (
        <>
          <rect x="9.1" y="3" width="1.6" height="3.4" rx="0.8" />
          <circle cx="9.9" cy="2.7" r="1.75" />
          <rect x="13.3" y="3" width="1.6" height="3.4" rx="0.8" />
          <circle cx="14.1" cy="2.7" r="1.75" />
          <ellipse cx="5.7" cy="9" rx="3.1" ry="1.9" transform="rotate(-24 5.7 9)" />
          <ellipse cx="18.3" cy="9" rx="3.1" ry="1.9" transform="rotate(24 18.3 9)" />
          <ellipse className={PALE} cx="5.4" cy="9.1" rx="1.5" ry="0.8" transform="rotate(-24 5.4 9.1)" />
          <ellipse className={PALE} cx="18.6" cy="9.1" rx="1.5" ry="0.8" transform="rotate(24 18.6 9.1)" />
          <ellipse cx="12" cy="13.2" rx="4.8" ry="7.6" />
          <circle className={PALE} cx="9.9" cy="8.4" r="1.5" />
          <circle className={PALE} cx="14.2" cy="9.6" r="1.25" />
          <ellipse className={PALE} cx="12" cy="18.3" rx="3.4" ry="2.6" />
          <circle cx="10.8" cy="17.9" r="0.6" />
          <circle cx="13.2" cy="17.9" r="0.6" />
          {eyes(2.5, 13.2, 1.5, 0.8)}
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
