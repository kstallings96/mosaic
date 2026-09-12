# MOSAIC

A short web app that teaches constraint satisfaction through graph colouring, and logs every student action for a classroom study. One session is about ten minutes.

**One rule, the whole way through: two regions that touch cannot share a colour.** Nothing else has to be explained, at any level.

## Why colouring

The constraint is a single sentence a child already understands, and it makes the abstractions visible without ever naming them:

| Idea | What the student sees |
|---|---|
| Domain | The colours a region has left. The palette shows them; ones a neighbour took are struck out. |
| Propagation | Colouring one region shrinks its neighbours' options, in a visible wave. |
| Forced move | A region with one colour left. The rule decided it, not you. |
| Dead end | A region with none left. Something placed earlier has to come back out. |
| MRV heuristic | When nothing is forced, take the region with the fewest colours left. |

## The three levels

Difficulty is set by how tight the graph is relative to three colours, **not by how many regions it has**. A full hexagon gives every interior region six neighbours, so domains collapse at once and the whole map falls out of forced moves alone — a bigger hexagon is a longer level, not a harder one, and the heuristic never gets used. Carving bays into the map, and then leaving the map altogether, is what creates genuine choice.

| Level | Board | Forced moves finish | Regions needing a decision |
|---|---|---|---|
| 1 · The rule | 7-region map | all 5, over 3 waves | **0** |
| 2 · When nothing is forced | 16-region carved map | 7, over 7 waves | **6** |
| 3 · It was never a map | 14-node graph | 0 | **12** |

Level 3 drops the geography: the same rule, now radio towers whose signals overlap. Nothing is forced at the start, so the heuristic is the only way in, and a wrong choice can reach a genuine dead end.

## Unique solutions, and the symmetry problem

Colourings are never unique on their own, because the colours are interchangeable — swap two throughout and you have another valid answer. Each level pre-colours two or three regions to collapse that.

`npm run verify-levels` re-checks the committed data independently of the generator: that each level has exactly one colouring, that the pre-colouring is genuinely doing the symmetry-breaking, that no region is too weakly connected to ever be constrained, and that the published difficulty numbers match reality. It exits non-zero on failure, so it can gate a deploy.

## Running it

```bash
npm install
npm run dev
```

The app runs fine with no backend: every network call becomes a no-op and events stay in `localStorage`, recoverable from the end screen. Add Supabase credentials to `.env.local` (see `.env.example`) to log for real.

| Command | |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck and production build |
| `npm run verify-levels` | re-verify the committed level data |
| `npm run generate-levels` | regenerate it from scratch |
| `npm run lint` | oxlint |

`?reset` on any URL clears the session and starts over — that is how a researcher hands the device to the next student.

## Data

Identifying fields (first name, last initial, grade) live in the `sessions` row and nowhere else. Event payloads carry only region indices, colour indices and timings, so the behavioural data can be analysed or shared without carrying names.

See [`DEPLOY.md`](DEPLOY.md) for Supabase and Vercel setup, and [`supabase/schema.sql`](supabase/schema.sql) for the schema, the row-level security policies, and starter analysis queries.
