import { COLOURS } from '../data/levels';
import type { SearchStep } from '../lib/search';

/**
 * The shape of the search.
 *
 * The scoreboard says 98 placed and 88 taken back, and a number that size
 * is just a number. The tree is the same fact as a picture: under the good
 * rule it is a staircase ten steps deep that never comes back up, and under
 * the rule a student would have invented it is a thicket. You can see how
 * much work was wasted without counting anything.
 *
 * Laid out with time across and depth down, which is the layout that makes
 * backtracking legible: a branch that fails shows as the line climbing back
 * up and setting off again from the same fork. A tidy tree layout would
 * hide exactly that, because it arranges siblings by position rather than
 * by when they were tried.
 */

export interface TreeNode {
  /** Time: which placement this was, counting from one. */
  t: number;
  depth: number;
  colour: number;
  parent: TreeNode | null;
  /** This branch ran a crate out of animals. */
  dead: boolean;
  /** Still standing at the end — the part of the search that was not wasted. */
  kept: boolean;
}

/**
 * Rebuild the tree from the step list.
 *
 * `place` descends, `undo` climbs back, `dead` marks the branch it happened
 * on. Nothing is stored during the search that is not already in the trace.
 */
export function buildTree(steps: SearchStep[]): TreeNode[] {
  const nodes: TreeNode[] = [];
  const path: TreeNode[] = [];
  let t = 0;

  for (const s of steps) {
    if (s.kind === 'place' && s.colour !== undefined) {
      t += 1;
      const node: TreeNode = {
        t,
        depth: path.length + 1,
        colour: s.colour,
        parent: path[path.length - 1] ?? null,
        dead: false,
        kept: true,
      };
      nodes.push(node);
      path.push(node);
    } else if (s.kind === 'dead') {
      const here = path[path.length - 1];
      if (here) here.dead = true;
    } else if (s.kind === 'undo') {
      const gone = path.pop();
      if (gone) gone.kept = false;
    }
  }
  return nodes;
}

export default function SearchTree({
  steps,
  upTo,
  maxT,
}: {
  steps: SearchStep[];
  /** How much of the trace has played; the tree grows with the run. */
  upTo: number;
  /** Width of the widest run so far, so the trees stay comparable. */
  maxT: number;
}) {
  const nodes = buildTree(steps.slice(0, upTo));
  const depth = Math.max(4, ...nodes.map((n) => n.depth));
  const W = Math.max(12, maxT) + 2;
  const H = depth + 1.4;

  return (
    <svg
      className="tree"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`search tree, ${nodes.length} placements`}
    >
      {nodes.map((n) =>
        n.parent ? (
          <line
            key={`e${n.t}`}
            className={n.kept ? 'tree-edge kept' : 'tree-edge'}
            x1={n.parent.t}
            y1={n.parent.depth}
            x2={n.t}
            y2={n.depth}
          />
        ) : null,
      )}
      {nodes.map((n) => (
        <circle
          key={n.t}
          className={`tree-node${n.dead ? ' dead' : ''}${n.kept ? ' kept' : ''}`}
          cx={n.t}
          cy={n.depth}
          r={n.dead ? 0.78 : 0.56}
          fill={n.dead ? 'var(--bad)' : COLOURS[n.colour]}
        />
      ))}
    </svg>
  );
}
