# Grid Solver

A browser tool that solves logic-grid puzzles (match colors, numbers, names…) from a short typed language and explains each step. No build step, no dependencies.

## Run

Keep `index.html`, `styles.css` and `solver.js` in one folder and open `index.html`.

## How it works

Type the puzzle on the left. The right side **updates live**: after `START`, and after every clue line you finish with Enter (the line you're still typing is ignored). Press **Update now** or `Ctrl+Enter` to force a run. Grids above 400,000 combinations pause auto-update; the button still works (hard limit 4,000,000).

For every clue you see the number of possibilities left, how many it removed, newly certain facts, and the possibilities themselves when few remain.

## Example

```
SETUP
genes [g] 250 500 ...        // expands to 250 500 750 1000
bacteria [b] B D E L
doctor [d] I O L W
START
1000g and 500g = Lb and Wd
Bb - 500 = Db
b of Id - 250g = b of Od
Wd = 1000g xor Eb
Id then Eb
THRESHOLD = 1
```

## Language cheat sheet

| Piece | Meaning |
|---|---|
| `name [t] items` | Category with a one-letter lowercase tag |
| `250 500 ...` / `... 750 1000` / `250 ... 1000` | Number sequences (forward, backward, between) |
| `Wd`, `Eb` | Item name + tag |
| `1000g` | Number + tag: the item with that value |
| `b of Id` | The b-entity of Id |
| `= != < >` | Compare; numbers work with `+` and `-`: `Bb - 500 = Db` |
| `or xor and nand nor xnor` | Gates. Between values they distribute (`Wd = 1000g or Eb`); between statements use parentheses: `(A = B) xor (C = D)` |
| `not`, `=>`, `<=>` | Negation, if-then, if-and-only-if |
| `A and B = C and D` (or `A B = C D`) | Unordered pairing; a space between values means `and` |
| `A then B` | B is immediately after A in the numeric order |
| `A then ? then B` | One unknown slot between; `3?` means three |
| `A B then ?` | Loose group (any order, not necessarily adjacent), then the next slot |
| `A then+ B` | B is somewhere after A (any gap) |
| `A then ? then+ B` | At least one slot between A and B (`3?` = at least three) |
| `A B then+ C D` | Both C and D come after the later of A and B |
| `THRESHOLD = n` | Stop when ≤ n possibilities remain (default 1) |
| `LISTMAX = n` | List possibilities when ≤ n remain (default 50) |

Reserved words: `setup start solve threshold listmax proceed of and or xor not nand nor xnor then`.

## Notes

- Entities are tag-suffixed, so write `Acbb` for item `Acb` of category `[b]`.
- Order (`then`) follows the numeric category's values, ascending. With several numeric categories, include a number+tag in the clue to say which.
- One-unit arithmetic infers its unit; with several numeric categories write it (`500g`).

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout |
| `styles.css` | Styling (dark theme tokens) |
| `solver.js` | Parser, solver, UI |
| `ai-prompt.md` | Prompt that teaches an AI to translate plain-language clues into this language |
