# Grid Solver

A browser tool that solves logic-grid puzzles (match colors, numbers, names…) from a short typed language, explains each step and shows the answer as a table. No build step, no dependencies.

## Run

Keep `index.html`, `styles.css`, `editor.js` and `solver.js` in one folder and open `index.html`. (The fonts come from Google Fonts; offline, the browser falls back to system fonts.)

## How it works

Type the puzzle on the left. The right side **updates live**: after `START`, and after every clue line you finish with Enter (the line you're still typing is ignored). Press **Update now** or `Ctrl+Enter` to force a run. Grids above 400,000 combinations pause auto-update; the button still works (hard limit 4,000,000).

For every clue you see the number of possibilities left, how many it removed, newly certain facts, and the possibilities themselves when few remain. Hover a step to highlight its clue in the editor; click it to jump there.

### Answer table

When the clues give a result, a table appears below the steps:

- The **first category of `SETUP`** is the rows; every other category is a column.
- **Click a column header** to make that category the rows (the old row category takes its column).
- **Reorder columns** by dragging a header onto another one, with the `‹ ›` buttons on a header, or with `Alt+←` / `Alt+→` when a header is focused.
- If several possibilities remain (for example the threshold is above 1), the title says so; cells that are still open show the candidates, and `?` means not determined yet. Candidates are listed only while at most `LISTMAX` possibilities remain; with more, only certain facts are filled in.
- Row/column choices are remembered per puzzle layout (same category names and tags).

### Layout and editor

- **Resize the panels** by dragging the divider (or focus it and use `←` `→`, `Shift` for bigger steps). The default is 2 : 1 in favor of the editor; double-click the divider to reset. Panels never get narrower than 240 px.
- **Word wrap**: the `Wrap` toggle above the editor (or `Alt+Z`). Off by default.
- **Remembered** in the browser (localStorage): your last input, the panel split, the wrap setting and the table's row/column order. `Example` loads the sample puzzle; `Clear` empties the editor (and the empty editor is what comes back next time).
- The editor highlights the language, colors each category, flags mistakes on the line (hover or put the caret on it to read the message), and offers suggestions.

| Shortcut | Action |
|---|---|
| `Ctrl/⌘ Enter` | Solve now |
| `Ctrl Space` | Suggestions |
| `Tab` / `Esc` | Accept / close suggestion |
| `Ctrl/⌘ /` | Toggle comment |
| `Alt ↑ ↓` | Move line |
| `Shift Alt ↑ ↓` | Duplicate line |
| `Alt Z` | Toggle word wrap |
| click a line number | Select that line |
| click a category chip | Suggest that category's items |

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
Wd = 1000g or Eb

THRESHOLD = 1
SOLVE
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
| `LISTMAX = n` | List possibilities when ≤ n remain (default 10) |
| `SOLVE` | Optional end marker; everything after it is ignored |

Gate meanings: `or` at least one, `xor` exactly one, `and` all, `nor` none, `nand` not all, `xnor` not exactly one (with two statements: both or neither).

Reserved words (also not allowed as category or item names): `setup start solve threshold listmax proceed of and or xor not nand nor xnor then`.

## Notes

- Entities are tag-suffixed, so write `Acbb` for item `Acb` of category `[b]`.
- Order (`then`) follows the numeric category's values, ascending. With several numeric categories, include a number+tag in the clue to say which.
- One-unit arithmetic infers its unit; with several numeric categories write it (`500g`).
- `THRESHOLD` and `LISTMAX` can sit on any line before `SOLVE`.

## Files

| File | Purpose |
|---|---|
| `index.html` | Layout |
| `styles.css` | Styling (dark theme tokens) |
| `editor.js` | Code editor: highlighting, suggestions, line gutter, word wrap |
| `solver.js` | Parser, solver, steps, answer table, resizable panels, saved state |
| `Clue_to_GSL_PROMPT.md` | Prompt that teaches an AI to translate plain-language clues into this language |
