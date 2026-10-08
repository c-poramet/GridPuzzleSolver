# Grid Solver

A browser tool that solves logic-grid puzzles (match colors, numbers, names, …) from a short typed language. It explains every clue step by step and shows the answer as a table. No build step, no dependencies.

---

## Quick start

1. Keep `index.html`, `styles.css`, `editor.js` and `solver.js` in one folder and open `index.html`.
2. Press **Example** to load a sample puzzle, then **Update now** (or `Ctrl/⌘ Enter`).
3. Edit the text on the left and press **Update now** again. **Nothing runs automatically**: typing never re-solves, and the badge in the header shows `edited` until you update.

### Your first puzzle in two minutes

> Ann, Bob and Cy each adopt a different pet (cat, dog, fish) on days 1, 2 and 3.
> 1. The fish was adopted before the cat.
> 2. Cy adopted one day after Ann.
> 3. Ann did not adopt the fish.
> 4. Cy adopted the dog.

Type it as:

```
SETUP
friend [f] Ann Bob Cy
pet [p] Cat Dog Fish
day [d] 1 2 ...

START
Fishp then+ Catp      // 1  fish before cat (any gap)
Cyf = Annf + 1        // 2  Cy is one day after Ann
Annf != Fishp         // 3  Ann did not get the fish
Cyf = Dogp            // 4  Cy has the dog
SOLVE
```

What you will see, one step per clue:

| Step | Clue | Possibilities left |
|---|---|---|
| Start | | 36 |
| 1 | `Fishp then+ Catp` | 18 |
| 2 | `Cyf = Annf + 1` | 6 |
| 3 | `Annf != Fishp` | 3 |
| 4 | `Cyf = Dogp` | **1** |

Then the answer table appears (the first category of `SETUP` is the rows):

| friend [f] | pet [p] | day [d] |
|---|---|---|
| Ann | Cat | 2 |
| Bob | Fish | 1 |
| Cy | Dog | 3 |

Things to try right away:

- **Hover** a step to highlight its clue in the editor, **click** it to jump there.
- Hold **Shift** while hovering a step to see the clue explained in plain words.
- **Click a column header** in the answer table to make it the rows (for example, sort by `day`).

### The program in 10 seconds

```
SETUP                          ← one line per category:  name [tag] items...
START                          ← one clue per line
THRESHOLD = 1                  ← optional: stop when this many possibilities remain
LISTMAX = 10                   ← optional: list the possibilities when this few remain
SOLVE                          ← optional end marker
```

Comments start with `//`. Blank lines are fine.

### Cheat sheet: say it → write it

Entities are **item name + tag**: item `Cy` of category `[f]` is written `Cyf`. Numbers are **value + tag**: `2d` is the item of category `[d]` whose value is 2.

| In words | Write |
|---|---|
| Ann has the cat | `Annf = Catp` |
| Ann does not have the cat | `Annf != Catp` |
| Ann has the cat or the dog | `Annf = Catp or Dogp` |
| Ann has neither the cat nor the dog | `Annf != Catp or Dogp` |
| Exactly one of: cat or dog (xor) | `Annf = Catp xor Dogp` |
| Ann and Bob have cat and dog, in some order | `Annf Bobf = Catp Dogp` |
| Cy is one day after Ann | `Cyf = Annf + 1` |
| Cy is two days before Ann | `Cyf = Annf - 2` |
| Ann is later than Bob | `Annf > Bobf` |
| Ann and Bob together total 5 | `Annf + Bobf = 5` |
| Ann is at most Bob (≤) | `not (Annf > Bobf)` |
| Either (Ann has cat) or (Bob has dog), exactly one | `(Annf = Catp) xor (Bobf = Dogp)` |
| Both | `(Annf = Catp) and (Bobf = Dogp)` |
| If Ann has the cat then Bob has the dog | `(Annf = Catp) => (Bobf = Dogp)` |
| If and only if | `(Annf = Catp) <=> (Bobf = Dogp)` |
| Fish is immediately before cat | `Fishp then Catp` (same: `Catp after Fishp`) |
| One slot between fish and cat | `Fishp then ? then Catp` |
| Fish somewhere before cat | `Fishp then+ Catp` |
| At least one slot between | `Fishp then ? then+ Catp` |
| Fish, dog, cat in that order, gaps allowed | `Fishp then+ Dogp then+ Catp` |
| Dog is not first | `? then Dogp` |
| Dog is not last | `Dogp then ?` |
| Next to each other, either order | `(Fishp then Catp) or (Catp then Fishp)` |
| Dog is somewhere between fish and cat | `(Fishp then+ Dogp then+ Catp) or (Catp then+ Dogp then+ Fishp)` |

### Six rules that avoid most errors

1. **Every item needs its tag**: `Annf`, not `Ann`. The error message tells you which tag you probably meant.
2. **Join two statements with parentheses**: `(A = B) xor (C = D)`. Without them the gate is swallowed into the first comparison.
3. **One gate per list or chain**: mixing `and` with `or` needs parentheses.
4. **Numeric categories are for anything ordered or added**: dates, ranks, floors, prices. Names are fine when only equality is used.
5. **Several numeric categories? Name the unit**: `Annf = Bobf + 3d` or `d of Annf < d of Bobf`.
6. **`then` is about positions, `+ -` is about values.** "The next one" is `then`, "3 more than" is `+ 3`.

### Let an AI write the clues for you

Paste the contents of `Clue_to_GSL_PROMPT.md` into any AI chat, then paste your puzzle (categories and numbered clues). The AI answers with a ready-to-paste program plus notes about assumptions. Paste the code block into the editor and press **Update now**. See [Using an AI to translate clues](#using-an-ai-to-translate-clues).

---

# Full guide

## Contents

1. [Running and updating](#running-and-updating)
2. [Program structure](#program-structure)
3. [SETUP: categories and items](#setup-categories-and-items)
4. [Clues](#clues)
5. [Reading the results](#reading-the-results)
6. [Answer table](#answer-table)
7. [Layout and editor](#layout-and-editor)
8. [Error messages](#error-messages)
9. [Using an AI to translate clues](#using-an-ai-to-translate-clues)
10. [Limits and performance](#limits-and-performance)
11. [Reference](#reference)

---

## Running and updating

Open `index.html` from the folder that contains `styles.css`, `editor.js` and `solver.js`. The fonts come from Google Fonts; offline, the browser falls back to system fonts.

The page does not solve on load. The badge in the header tells you where you are:

| Badge | Meaning |
|---|---|
| `not updated` | Text is loaded but has not been solved yet |
| `edited` | You typed since the last update |
| `N left` | Number of possibilities left after the last update |
| `error` | The program has a mistake (the line is flagged in the editor) |

**Update now** or `Ctrl/⌘ Enter` solves. **Example** loads the sample puzzle and solves it. **Clear** empties the editor.

## Program structure

```
SETUP
<category name> [<tag>] <items…>

START
<one clue per line>

THRESHOLD = n
LISTMAX = n
SOLVE
```

- `SETUP`, `START` and `SOLVE` are alone on their line. Keywords are case-insensitive; item names and tags are case-sensitive.
- `THRESHOLD = n`: stop at the first clue after which at most `n` possibilities remain (default `1`, minimum `1`). Later clues are reported as "not needed".
- `LISTMAX = n`: list the remaining possibilities once at most `n` are left (default `10`). `0` turns the listing off.
- `THRESHOLD` and `LISTMAX` can sit on any line before `SOLVE`; the header tags show the values in use.
- `SOLVE` is an optional end marker; everything after it is ignored.
- `//` starts a comment that runs to the end of the line.

## SETUP: categories and items

One line per category: `name [tag] items…`

```
genes [g] 250 500 ...        // numeric, expands to 250 500 750 1000
bacteria [b] B D E L         // names
doctor [d] I O L W
```

**Rules**

- **Name**: one word (no spaces), not a reserved word.
- **Tag**: exactly one lowercase letter, unique per category. Pick a memorable one (`genes [g]`). The tag is how clues refer to the category and doubles as the unit for numbers (`500g`). Up to 26 categories.
- **Same size**: every category has the same number of items, **at most 12**. At least one category must list all its items in full; that sets the size.
- **Item names**: start with a letter, then letters, digits or `_` only. Not a single lowercase letter, not a reserved word. Two items in one category must differ. Initials are fine when unique (`B D E L`); if two share an initial, use short unique prefixes (`Abc`, `Acb`).
- **Numeric category**: all items are numbers. Decimals are fine. Anything that is ordered (`then`, `after`), compared (`<`, `>`) or added (`+`, `-`) must be numeric.

**Number sequences with `...`**

| Written | Expands to (N = 4) | Needs |
|---|---|---|
| `250 500 ...` | 250 500 750 1000 | two or more values before `...` |
| `... 750 1000` | 250 500 750 1000 | two or more values after `...` |
| `250 ... 1000` | 250 500 750 1000 | exactly the two end values, evenly spaced |

Only one `...` per line, and it must expand to exactly N values. A category that uses `...` cannot be the one that sets N. Irregular values: just list them all.

**Reserved words** (not allowed as category or item names, in any capitalization):
`setup start solve threshold listmax proceed of and or xor not nand nor xnor then after`

## Clues

### Referring to things

| Written | Meaning |
|---|---|
| `Wd` | Item `W` of the category tagged `d` (item name + tag; the last character is the tag) |
| `1000g` | The item of numeric category `g` whose value is 1000 (must exist) |
| `5`, `5.5` | A plain number, for arithmetic or numeric comparison |
| `b of Id` | The `b`-entity belonging to `Id` ("the bacteria sequenced by Dr. Ingram") |
| `g of Id` | Same, with a numeric tag: the `g` value of `Id`. It also fixes the unit to `g` |

`tag of X` is another way to say "X's row"; it never changes which item is meant, it documents it and (for numeric tags) sets the unit. If an item name already ends in the letter of its own tag, keep both: item `Acb` of category `[b]` is `Acbb`.

### Comparing

`=` same thing · `!=` different · `<` less · `>` more.

```
Wd = Eb              // the two entities are in the same row (same thing)
Wd != Eb
Bb - 500 = Db        // arithmetic works on the numeric category's values
Annf > Bobf          // numeric comparison
```

With **one** numeric category the unit is picked automatically. With several, put a unit on a number (`Bb - 500g = Db`) or use `g of X` (`g of Bb < g of Db`). One expression, one unit. Only `+` and `-` exist (no `*`, `/`, `<=`, `>=`, unary minus). For ≤ and ≥ use `not (A > B)` and `not (A < B)`.

### Lists of values (distribution)

A gate between values distributes over the comparison:

```
Wd = 1000g or Eb         // (Wd = 1000g) or (Wd = Eb)
Wd = 1000g xor Eb        // exactly one of the two
Wd = 1000g nor Eb        // neither
Wd != 1000g or Eb        // neither (!= with a list means "none of them")
Annf < Bobf or Cyf       // any gate works with < and >
```

- A space between values means `and`.
- `=` with `and` against a single value is an error (one thing cannot equal two things). Did you mean `or` / `xor`?
- `!=` with a list accepts only `or` / `and`, and both mean "none of them".

### Pairing (unordered)

```
1000g and 500g = Lb and Wd      // same as: 1000g 500g = Lb Wd
```

Reads: `{1000g, 500g}` is the same set as `{Lb, Wd}`, in either order. Only `=`, only `and`, and both sides must have the same length.

### Gates between statements

| Gate | Meaning |
|---|---|
| `and` | all are true |
| `or` | at least one is true |
| `xor` | exactly one is true |
| `nand` | not all are true |
| `nor` | none is true |
| `xnor` | not exactly one (with two statements: both or neither) |

Between **statements** you need parentheses:

```
(A = B) xor (C = D)       ✔
A = B xor C = D           ✘ the xor is swallowed into "B xor C"
```

Use one gate per chain; mixing different gates needs parentheses.

### If-then and negation

```
(A = B) => (C = D)        // if A = B then C = D
(A = B) <=> (C = D)       // exactly when
not (A < B + 3)           // negation; at least 3 more than B
```

One `=>` or `<=>` per clue (nest with parentheses if you need more).

### Order: `then` and `after`

Order always follows the **numeric category's values, ascending**. Positions are slots in that order, not value differences.

| Written | Meaning |
|---|---|
| `A then B` | B is immediately after A |
| `A after B` | A is immediately after B (same as `B then A`) |
| `A then+ B` | B is somewhere after A, any gap |
| `A after+ B` | A is somewhere after B (same as `B then+ A`) |
| `A then ? then B` | One unknown slot between (`3?` = three) |
| `A then ? then+ B` | At least one slot between (`3?` = at least three) |
| `A then B then C` | Three consecutive slots |
| `A then+ B then+ C` | In that order, gaps allowed |
| `? then A` | A is not first (at least one slot before) |
| `A then ?` / `A then 2?` | At least one / two slots after A |
| `A B then C` | C is right after whichever of A, B is later |
| `A B then ?` | The later of A, B is not the last slot |
| `A B then+ C D` | C and D both come after the later of A and B |

**Groups.** Entities side by side (up to 4) form a loose group: any order, not necessarily adjacent. As the left side of `then` the next slot is measured from the group's last member; as the right side, from its first member.

**Rules.**

- Use one direction per chain: do not mix `then`/`then+` with `after`/`after+`.
- Slots must be entities, number+tag values (`1000g`) or `g of X`. No arithmetic and no bare numbers.
- No gate words inside a chain. Combine chains with gates via parentheses: `(A then B) or (B then A)`.
- With several numeric categories, include a number+tag or `g of X` so the solver knows which one to order by (`Id then 1000g`).

### Recipes for common wordings

| Clue wording | Write |
|---|---|
| A has N more than B | `A = B + N` |
| A has N fewer than B | `A = B - N` |
| A at least N more than B | `not (A < B + N)` |
| A at most N more than B | `not (A > B + N)` |
| A, B, C all different | `(A != B) and (B != C) and (A != C)` |
| Of A, B, C: one X, one Y, one Z | `A B C = X Y Z` |
| Not both / neither | `(A = X) nand (B = Y)` / `(A = X) nor (B = Y)` |
| A is N places before B (N ≥ 2) | `A then (N-1)? then B` |
| Twice as many (not supported) | List the valid pairs: `((A = 4r) and (B = 2r)) or ((A = 8r) and (B = 4r))` |

## Reading the results

For every clue you see one **step**:

- **Possibilities left** after that clue, and how many it removed (`−18`) when both counts are exact.
- **Chips** with facts that just became certain, written relative to the first category: `Annf = 2d` means Ann's row has day 2.
- **The possibilities themselves** (one line per arrangement, rows separated by `|`) when at most `LISTMAX` remain.

The bar above the steps shows the starting number of possibilities, the number remaining and the number of clues.

**Banners**

| Banner | Meaning |
|---|---|
| Single solution found / Threshold reached | The count dropped to `THRESHOLD` or below. Later clues are not processed and are listed as not needed |
| Contradiction at clue N | No arrangement satisfies clues 1…N. The clue's line is flagged in the editor: check that clue |
| N possibilities remain after all clues | You ran out of clues before reaching the threshold |

**Count notation**

| Shown | Meaning |
|---|---|
| `1,296` | Exact count |
| `≥ 12,000` | Lower bound: the search budget ran out |
| `≈ 3.4×10^12` | Estimate, or larger than exact precision allows |

Early stopping only happens on exact counts.

**Interacting with steps**

- Hover a step: its clue is highlighted in the editor. Click: jump to the line.
- Hold **Shift** while hovering: a tooltip explains the clue in plain words ("Clue 3 · in plain words").

## Answer table

When the clues give a result (a unique solution, or at least one certain fact), a table appears below the steps.

- The **first category of `SETUP`** is the rows; every other category is a column. If the row category is numeric, rows are sorted ascending.
- **Click a column header** to make that category the rows (the old row category takes its column).
- **Reorder columns** by dragging a header onto another one, with the `‹ ›` buttons on a header, or with `Alt+←` / `Alt+→` when a header is focused. `Enter` or `Space` on a focused header uses it as the rows.
- Title: **Solution** when exactly one possibility remains, otherwise "N possibilities left".
- Cells that are still open show up to three candidates plus `+N`. `?` means nothing could be determined for that cell yet.
- Each category keeps its own color, the same in the editor and in the table.
- The row/column choice is remembered for the current puzzle layout (same category names and tags).

## Layout and editor

- **Resize the panels** by dragging the divider, or focus it and use `←` `→` (`Shift` for bigger steps; `Home` or `Enter` resets). The default is 2 : 1 in favor of the editor; double-click the divider to reset. Panels never get narrower than 240 px.
- **Word wrap**: the `Wrap` toggle above the editor, or `Alt+Z`. Off by default.
- **Remembered in this browser** (localStorage): your last input, the panel split, the wrap setting and the table's row/column order. A first visit loads the example; `Clear` empties the editor, and the empty editor is what comes back next time.
- The editor highlights the language, colors each category, flags mistakes on the line (hover or put the caret on it to read the message) and offers suggestions.

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

## Error messages

Errors appear in the results panel with the line number, and the line is flagged in the editor.

| Message (shortened) | Usual cause and fix |
|---|---|
| `Begin with SETUP` / `Missing START` / `Missing SETUP section` | A section header is missing or lines come before `SETUP` |
| `Expected: name [tag] items…` | A `SETUP` line is malformed, or the name has a space |
| `Tag [x] must be exactly one lowercase letter` / `is already used` | Fix or change the tag |
| `"X" is a reserved word` | Rename the category or item |
| `"W" is missing its tag. Did you mean "Wd"?` | Add the category's tag to the item |
| `Unknown word "W" (tag … is not declared)` | Typo, or the tag does not exist |
| `"X" is not an item of …` | The item name is not in that category (options are listed) |
| `Which unit? Options: …` | Several numeric categories: write `500g` or `g of X` |
| `Mixed units …` | One expression uses two numeric categories |
| `Two comparisons in a row: wrap each statement in parentheses` | `A = B xor C = D` → `(A = B) xor (C = D)` |
| `Mixing different gates needs parentheses` | Use one gate per list or chain |
| `One thing cannot equal two things` | `=` with `and`: use `or` / `xor`, or pairing `A B = C D` |
| `Gates … cannot be used inside a then/after chain` | Put gates between parenthesized chains |
| `Do not mix "then" and "after" in one chain` | Pick one direction |
| `Two lists compare only as "A and B = C and D" of equal length` | Fix the pairing |
| `Contradiction at clue N` | The clues so far cannot all be true: re-check clue N |

## Using an AI to translate clues

`Clue_to_GSL_PROMPT.md` teaches an AI assistant the language.

1. Paste the whole file into a new AI chat.
2. Paste your puzzle: the categories with their items, then the clues, numbered.
3. Copy the code block from the answer into the editor and press **Update now**.
4. Read the AI's **Notes**: they list assumptions, ambiguous clues with the alternative reading, and anything the language cannot express.
5. The AI writes one clue per line, so **solver step N = clue N**. If a step looks wrong, check clue N first (hover the step, or hold Shift for the plain-language reading).

## Limits and performance

- At most **12 items per category** and **26 categories** (one tag each). There is no fixed cap on the number of combinations, but bigger puzzles take longer.
- Counting has a time budget per step. When a count is too large to finish exactly you will see `≥` (lower bound) or `≈` (estimate); the answer table still shows what is certain.
- Typical puzzles (3–6 categories of 4–8 items) solve instantly.
- Negative numbers cannot be written in clues; `<=`, `>=`, `*`, `/` do not exist (see the recipes above).

## Reference

### Language cheat sheet

| Piece | Meaning |
|---|---|
| `name [t] items` | Category with a one-letter lowercase tag |
| `250 500 ...` / `... 750 1000` / `250 ... 1000` | Number sequences (forward, backward, between) |
| `Wd`, `Eb` | Item name + tag |
| `1000g` | Number + tag: the item with that value |
| `b of Id` / `g of Id` | The `b` / `g` entity of `Id` (numeric tag also sets the unit) |
| `= != < >` | Compare; numbers work with `+` and `-`: `Bb - 500 = Db` |
| `or xor and nand nor xnor` | Gates. Between values they distribute (`Wd = 1000g or Eb`); between statements use parentheses: `(A = B) xor (C = D)` |
| `not`, `=>`, `<=>` | Negation, if-then, if-and-only-if |
| `A and B = C and D` (or `A B = C D`) | Unordered pairing; a space between values means `and` |
| `A then B` / `A after B` | B is immediately after A / A is immediately after B |
| `A then ? then B` | One unknown slot between; `3?` means three |
| `A B then ?` | Loose group (any order, not necessarily adjacent), then the next slot |
| `A then+ B` / `A after+ B` | B is somewhere after A / A is somewhere after B |
| `A then ? then+ B` | At least one slot between (`3?` = at least three) |
| `A B then+ C D` | Both C and D come after the later of A and B |
| `THRESHOLD = n` | Stop when ≤ n possibilities remain (default 1) |
| `LISTMAX = n` | List possibilities when ≤ n remain (default 10) |
| `SOLVE` | Optional end marker; everything after it is ignored |

### The built-in example

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

### Files

| File | Purpose |
|---|---|
| `index.html` | Layout |
| `styles.css` | Styling (dark theme tokens) |
| `editor.js` | Code editor: highlighting, suggestions, line gutter, word wrap |
| `solver.js` | Parser, solver, steps, answer table, resizable panels, saved state |
| `Clue_to_GSL_PROMPT.md` | Prompt that teaches an AI to translate plain-language clues into this language |
| `README.md` | This guide |

### Saved in the browser

| Key (localStorage) | Content |
|---|---|
| `gridsolver.src` | Your last input |
| `gridsolver.split` | Panel split |
| `gridsolver.order` | Answer table row/column order for the current layout |
| (editor) | Word wrap setting |

Clear your site data to reset everything.