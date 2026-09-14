/**
 * The guests.
 *
 * Fourteen identical circles told a student nothing, and "guests at a
 * dinner" deserves characters. These are creatures rather than people, for
 * the same reason the rest of the app avoids drawing faces: a silhouette
 * with hair, skin or a build says something about who a student is meant
 * to see, and nothing here needs to say that. Ears and a bow tie carry the
 * identity instead.
 *
 * Identity is shape only, never colour. Colour on this board means which
 * table someone is sitting at, and a guest who carried a hue of their own
 * would look like they were already seated.
 */

/** Seven ear shapes, drawn on a 24x24 head centred at (12, 12). */
const EARS: string[] = [
  // cat: two sharp triangles
  'M5.5 7.5 L4 1.5 L10 5 Z M18.5 7.5 L20 1.5 L14 5 Z',
  // bear: two round bumps
  'M5.5 5.5a3 3 0 1 1 4.2 0z M18.5 5.5a3 3 0 1 0-4.2 0z',
  // rabbit: two long uprights
  'M8.5 6 C7 -1 9.5 -1 10.4 5.2 Z M15.5 6 C17 -1 14.5 -1 13.6 5.2 Z',
  // owl: two feather tufts
  'M5 6.5 L3.5 2 L9.5 5.5 Z M19 6.5 L20.5 2 L14.5 5.5 Z',
  // mouse: two big discs
  'M5 6a3.6 3.6 0 1 1 5 0z M19 6a3.6 3.6 0 1 0-5 0z',
  // fox: swept-back points
  'M5.5 7 L2.5 2 L10 5 Z M18.5 7 L21.5 2 L14 5 Z',
  // none: a smooth crest
  'M12 2.4 C9 3.2 7.6 4.6 7 6 L17 6 C16.4 4.6 15 3.2 12 2.4 Z',
];

/**
 * Fourteen guests: seven ear shapes, each with and without a bow tie. Every
 * pair is a different silhouette, so no two are confusable at 34px.
 */
export const GUEST_COUNT = 14;

export function guestName(i: number): string {
  const ears = ['Cat', 'Bear', 'Hare', 'Owl', 'Mouse', 'Fox', 'Bird'];
  return `${ears[i % 7]} ${i < 7 ? 'A' : 'B'}`;
}

export default function GuestFace({ index, size = 34 }: { index: number; size?: number }) {
  const ears = EARS[index % EARS.length];
  const bowTie = index >= 7;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className="guest-face"
    >
      <path d={ears} fill="currentColor" />
      <circle cx="12" cy="13" r="7.4" fill="currentColor" />
      {/* Eyes are punched out of the head rather than drawn on top, so they
          read at any size and against any table colour. */}
      <circle cx="9.5" cy="12.2" r="1.15" className="guest-eye" />
      <circle cx="14.5" cy="12.2" r="1.15" className="guest-eye" />
      {bowTie ? (
        <path d="M12 19.4 L8.6 17.6 L8.6 21.2 Z M12 19.4 L15.4 17.6 L15.4 21.2 Z" fill="currentColor" />
      ) : null}
    </svg>
  );
}
