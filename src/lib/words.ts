import type { ColourLevel } from '../data/levels';
import { COLOUR_NAMES } from '../data/levels';

/**
 * What to call things when talking to the student.
 *
 * It lives in one place because three different files say these words —
 * the board when it refuses a move, the helper when it explains one, the
 * status line under the board — and a level that calls them animals in one
 * sentence and colours in the next has stopped being a zoo.
 */

/** Level three's three choices are animals, not colours. */
export const ANIMAL_NAMES = ['Elephant', 'Lion', 'Giraffe'] as const;

/** The bare name: 'Elephant', or 'Teal'. */
export function slotName(level: ColourLevel, v: number): string {
  return level.icons === 'animals'
    ? ANIMAL_NAMES[v % ANIMAL_NAMES.length]
    : COLOUR_NAMES[v];
}

/**
 * The name inside a sentence. An animal takes an article where a colour
 * does not: you lose teal, but you lose the elephant.
 */
export function slotWord(level: ColourLevel, v: number): string {
  return level.icons === 'animals'
    ? `the ${slotName(level, v).toLowerCase()}`
    : COLOUR_NAMES[v].toLowerCase();
}

/** 'a crate', but 'an animal'. */
export function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** The same, starting a sentence. */
export function Article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'An' : 'A';
}
