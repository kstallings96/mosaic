/**
 * The animals.
 *
 * There are three, one per colour, and that is the whole point: the colour
 * and the animal are two ways of saying the same thing. A student who
 * cannot separate the teal from the pink can still separate an elephant
 * from a giraffe, and anyone who can do both has the fact twice.
 *
 * They are pale with a dark outline, not dark with pale detail. A dark
 * animal on a saturated crate is a hole in the crate: at forty pixels the
 * lion's mane swallowed its face and all three read as blobs. Pale bodies
 * put the ink where ink belongs — the outline, the eyes, the spots — which
 * is how a sticker is drawn and why a sticker reads at any size.
 *
 * The outline comes from CSS, so every shape here inherits it and the
 * pieces overlap the way a drawing does: an ear keeps its own edge where
 * it sticks out past the head, and loses it underneath.
 */

export const ANIMALS = ['Elephant', 'Lion', 'Giraffe'] as const;

export function animalName(index: number): string {
  return ANIMALS[index % ANIMALS.length];
}

/** Eyes, nostrils, spots — solid dark, no outline of their own. */
const INK = 'animal-ink';
/** A thin dark line: an ear crease, the line round a muzzle. */
const LINE = 'animal-line';
/**
 * A tube is drawn twice — a wide dark stroke, then a narrower pale one on
 * top — which is how a trunk or a tusk gets an outline without being a
 * closed path. Drawing the pale pass after the head also breaks the head's
 * outline exactly where the trunk joins it, so the two read as one animal.
 */
const EDGE = 'animal-edge';
const TUBE = 'animal-tube';
/** Fill with no outline, for shapes that overlap each other and must merge. */
const FLAT_INK = 'animal-flat-ink';
const FLAT = 'animal-flat';

/** A ring of bumps, for the one animal that is mostly hair. */
function mane(bump: number) {
  return Array.from({ length: 12 }, (_, k) => {
    const a = (2 * Math.PI * k) / 12;
    return <circle key={k} cx={12 + 8.2 * Math.cos(a)} cy={12 + 8.2 * Math.sin(a)} r={bump} />;
  });
}

function Shape({ i }: { i: number }) {
  switch (i % ANIMALS.length) {
    case 0: // elephant — ears, tusks, and a trunk that curls
      return (
        <>
          <circle cx="4.9" cy="10.3" r="5.3" />
          <circle cx="19.1" cy="10.3" r="5.3" />
          <path className={EDGE} d="M9 14.4c-1.2 1.8-1.6 3.2-1.4 4.5" strokeWidth="3.2" />
          <path className={EDGE} d="M15 14.4c1.2 1.8 1.6 3.2 1.4 4.5" strokeWidth="3.2" />
          <path className={EDGE} d="M12 13.8v4.6c0 2.1 1.2 3.2 2.6 3.2" strokeWidth="5" />
          <rect x="7.2" y="4.3" width="9.6" height="11.8" rx="4.8" />
          <path className={TUBE} d="M9 14.4c-1.2 1.8-1.6 3.2-1.4 4.5" strokeWidth="1.4" />
          <path className={TUBE} d="M15 14.4c1.2 1.8 1.6 3.2 1.4 4.5" strokeWidth="1.4" />
          <path className={TUBE} d="M12 13.8v4.6c0 2.1 1.2 3.2 2.6 3.2" strokeWidth="3" />
          <path className={LINE} d="M4.4 7.9c1.9.8 2.5 2.8 1.8 5.4" />
          <path className={LINE} d="M19.6 7.9c-1.9.8-2.5 2.8-1.8 5.4" />
          <circle className={INK} cx="9.9" cy="9.6" r="1.1" />
          <circle className={INK} cx="14.1" cy="9.6" r="1.1" />
        </>
      );
    case 1: // lion — a scalloped mane round a clean face
      return (
        <>
          {/* The mane is a dozen overlapping circles, so it cannot carry
              the shared outline — twelve strokes would cross each other
              inside it. It gets a dark pass and a pale pass instead. */}
          <g className={FLAT_INK}>{mane(4)}</g>
          <g className={FLAT}>{mane(3.3)}</g>
          <circle cx="12" cy="12" r="6.7" />
          <circle className={INK} cx="9.8" cy="10.9" r="1.1" />
          <circle className={INK} cx="14.2" cy="10.9" r="1.1" />
          <path className={INK} d="M12 13 13.5 14.4h-3Z" />
          <path className={LINE} d="M12 14.5v1.2M12 15.7c-.6.9-1.9.9-2.4.05M12 15.7c.6.9 1.9.9 2.4.05" />
        </>
      );
    default: // giraffe — ossicones, side ears, and its own spots
      return (
        <>
          <rect x="9.15" y="3" width="1.7" height="3.6" rx="0.85" />
          <circle cx="10" cy="2.7" r="1.75" />
          <rect x="13.15" y="3" width="1.7" height="3.6" rx="0.85" />
          <circle cx="14" cy="2.7" r="1.75" />
          <ellipse cx="5.6" cy="9" rx="3.1" ry="1.9" transform="rotate(-24 5.6 9)" />
          <ellipse cx="18.4" cy="9" rx="3.1" ry="1.9" transform="rotate(24 18.4 9)" />
          <ellipse cx="12" cy="13.2" rx="4.9" ry="7.6" />
          <circle className={INK} cx="9.5" cy="8.3" r="1.2" />
          <circle className={INK} cx="14.6" cy="9.5" r="1.05" />
          <circle className={INK} cx="9.4" cy="13.4" r="1.15" />
          <circle className={INK} cx="14.6" cy="13.4" r="1.15" />
          <ellipse className={LINE} cx="12" cy="18.2" rx="3.3" ry="2.6" />
          <circle className={INK} cx="10.9" cy="17.8" r="0.6" />
          <circle className={INK} cx="13.1" cy="17.8" r="0.6" />
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
