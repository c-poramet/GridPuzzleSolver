# Grid Solver

Grid Solver is a no-build, dependency-free browser tool for solving logic-grid puzzles with the Grid Solver Language (GSL). Open `index.html` from the folder; it also works from `file://`.

## Quick start

1. Open `index.html`.
2. Press **Example**, then **Update now** (`Ctrl/⌘ Enter`).
3. Edit the left-hand program and update when ready. Typing never solves automatically; the badge becomes `edited`.

### Your first puzzle

Short form (automatic tags):

```
SETUP
friend Ann Bob Cy
pet Cat Dog Fish
day 1 ... 3

START
Fish before Cat
Cy = Ann + 1
Ann != Fish
Cy = Dog
```

Long form, compatible with the original syntax:

```
SETUP
friend [f] Ann Bob Cy
pet [p] Cat Dog Fish
day [d] 1 2 ...
START
Fishp then+ Catp
Cyf = Annf + 1
Annf != Fishp
Cyf = Dogp
```

Both programs produce the same 36 → 18 → 6 → 3 → 1 steps. `SOLVE` is an optional end marker.

### A larger worked example

This classic six-category puzzle demonstrates a declared numeric unit, glued
number-plus-tag references such as `3h`, `1h`, and `10o`, and order clues with
parenthesized alternatives:

```
SETUP
house [h] 1 2 ...
color [c] Red Green White Yellow Blue
nation [n] British Swedish Dane Norwegian German
drink [d] Tea Coffee Milk Beer Water
cigar [s] Dunhill PallMall Blends Bluemasters Prince
pet [p] Dog Bird Cat Horse Fish

START
Britishn = Redc
Swedishn = Dogp
Danen = Tead
Greenc then Whitec
Greenc = Coffeed
PallMalls = Birdp
Yellowc = Dunhills
Milkd = 3h
Norwegiann = 1h
(Blendss then Catp) or (Catp then Blendss)
(Horsep then Dunhills) or (Dunhills then Horsep)
Bluemasterss = Beerd
Germann = Princes
(Norwegiann then Bluec) or (Bluec then Norwegiann)
(Blendss then Waterd) or (Waterd then Blendss)
SOLVE
```

`3h`, `1h`, and `10o` mean a value or position in the category tagged `h` or
`o`. The suffix may contain multiple lowercase letters; it is not the same as
writing a bare category tag such as `o`, which is reserved for `o of X`.

## Cheat sheet: say it → write it

| In words | Short | Long |
|---|---|---|
| Ann has Cat | `Ann = Cat` | `Annf = Catp` |
| Earlier than | `A < B` | `A then+ B` |
| Immediately before | `A then B` | `A right before B` |
| Adjacent | `A adj B` | `A beside B` |
| Value distance | `A ~ B = 2` | `A apart B = 2` |
| All different | `alldiff A B C` | `all different A B C` |
| Exactly N statements | `N of (...)` | `exactly N of (...)` |
| At least / at most | `N+ of (...)` / `N- of (...)` | `atleast N of (...)` / `atmost N of (...)` |
| Default unit | `UNIT = d` | `DEFAULT UNIT = d` |
| Total | `sum(A B)` | `total(A B)` |
| Same set | `A B = C D` | `{A B} = {C D}` |
| Every friend | `each f: .p = Cat` | `each friend: .pet = Cat` |

The editor highlights these forms, suggests items/categories with `Ctrl Space`, and accepts `Tab` or `Esc` as usual.

## Full guide

### Program structure

```
SETUP
category [tag] items...
START
one clue per line
THRESHOLD = 1
LISTMAX = 10
DEFAULT UNIT = day
SOLVE
```

Keywords and names are case-insensitive; tags are lowercase and case-sensitive. Comments begin with `//`. `THRESHOLD` stops at a count, and `LISTMAX` controls displayed arrangements.

### Tags, names and aliases

Tags are optional, unique, and one or more lowercase letters. Missing tags receive the shortest available category-name prefix after explicit tags are reserved. Tags may overlap (`r` and `fr`). Items may be single letters and may have the same spelling in different categories. Use `Red.c`, `Redc`, or a quoted name to disambiguate. Names and aliases are case-insensitive while declared spelling is displayed.

Use quotes for spaces and punctuation: `"Mrs Brown"`. Slash-separated aliases display the first spelling: `Alexander/Al/Alex`. Numeric items cannot have aliases. A bare item is preferred where the grammar expects an operand; infix words are keywords only where an operator is expected.

### Ranges and predefined sets

`...` and `..` are range markers. Numeric forms include `1 2 ...`, `... 5 10`, `1 ... 10`, and `2 ... 10 step 2`. Letter ranges preserve case. Named ranges work with `DAYS`, `WEEKDAYS`, `MONTHS`, `SEASONS` (including `Fall`) and `ZODIAC`; three-letter aliases such as `Mon` and `Jan` are accepted. Cyclic sets wrap forward. A range may be mixed with ordinary items. Counts still must match the grid size and `MAX_ITEMS` (12).

`ordered` makes a named category order-capable; `unordered` removes that property. `circular` wraps positions and implies ordered. Numeric categories are already ordered.

### Units and references

A numeric or ordered category is a unit. Units are inferred from an explicit
suffix, an operand, `DEFAULT UNIT`, or the sole order-capable category. A
number may be glued to a one-or-more-letter unit tag: `5o`, `1h`, `10o`,
`2.5kg`. With several candidates the diagnostic says `Which unit?` and offers
fixes. `X.cat`, `X's cat`, and `cat of X` are equivalent and chainable.
`X.own_category` selects X itself.

### Operators, order and position

GSL supports `= != < > <= >= + - * /`, unary minus, parentheses, and `~`/`apart`. Arithmetic uses values; `beside`/`adj` and `within` use slot distance. `then`/`after` describe positions. `before`, `right before/after`, `N before/after`, `N+ before`, `first`, `last`, `at N`, `between`, and circular-only `opposite` are available. `then ? then` and legacy `then+`, `after+` remain valid.

Chains (`A < B < C`, `A = B = C`) apply pairwise. Use `alldiff`/`allsame` for explicit intent. A circular category rejects linear-only words and suggests a circular alternative.

### Sets, counting and `each`

Braced sets support equality and membership: `{A B} = {C D}`, `A in {B C}`, and set inequality. The legacy unbraced pairing form remains valid. Counting accepts any statements: `exactly N of (...)`, `atleast`, `atmost`, and their `N`, `N+`, `N-` aliases. `each category: statement` expands once per item; `.day`, `.pet`, and other leading-dot references mean the current row. Nested `each` is rejected clearly.

### Aggregates and subject blocks

`total`/`sum`, `avg`, `max`, and `min` accept space- or comma-separated expressions. Bare `max`/`min` means the unit extreme. A subject block is one step: `Ann: Cat, != 1, before Bob`; bare parts mean equality and are joined with `and`. Given rows are therefore concise without changing step numbering.

### Results and editor

Steps show counts, newly certain facts, optional arrangements, and plain-language explanations (hold Shift while hovering). The answer table can be reordered. **Normalize** (`Ctrl/⌘ Alt N`) rewrites selected lines to conservative canonical long spelling; it never runs the solver. Quick fixes use a lightbulb and `Ctrl/⌘ .`; they edit text, preserve undo, and set the badge to `edited`.

## Upgrading from old syntax

Everything that worked before remains valid, including tagged entities, `then`/`after`, `of`, list gates, `THRESHOLD`, and `LISTMAX`. Tags may now be multi-letter or omitted; names are case-insensitive; keywords are contextual; single-letter items are legal; ambiguity is reported instead of guessed; the 26-category limit is gone; and `<=`, `>=`, `*`, `/`, unary minus and distance now exist. Old workaround recipes remain accepted but are no longer required.

## Errors and quick fixes

| Diagnostic | Lightbulb fix |
|---|---|
| Unknown or ambiguous name/tag | Choose a named reading or nearest spelling |
| `Which unit?` | Insert `DEFAULT UNIT = candidate` |
| Non-ordered category used in order | Add `ordered` |
| Mixed gates, comparisons, or chain directions | Add parentheses or choose one direction |
| Bad/duplicate tag, item, alias, or category | Rename, remove, or choose next free tag |
| Range count/step problem | Narrow an end or add `step` |
| Missing quote/brace/parenthesis | Insert the closing delimiter |
| Circular category with linear word | Use `right before`, `beside`, or another circular form |
| Invalid threshold/list limit | Reset to the default |
| Contradiction | Comment out the clue after checking earlier clues |

Every diagnostic includes its source line. Solver errors remain authoritative; the editor is intentionally lightweight and does not solve while typing.

## Shortcuts

| Action | Shortcut |
|---|---|
| Update/solve | `Ctrl/⌘ Enter` |
| Autocomplete | `Ctrl Space`, `Tab`, `Esc` |
| Quick fixes | `Ctrl/⌘ .` |
| Normalize selection | `Ctrl/⌘ Alt N` |
| Comment | `Ctrl/⌘ /` |
| Move line | `Alt ↑ ↓` |
| Duplicate line | `Shift Alt ↑ ↓` |
| Wrap | `Alt Z` |

## Limits and files

Each category has at most 12 items. There is no fixed 26-category limit;
performance is the practical constraint. Large grids may show estimates. There
is no build step or dependency.

| File | Purpose |
|---|---|
| `index.html` | Page structure and solver output |
| `styles.css` | Dark theme and layout |
| `editor.js` | Highlighting, autocomplete, diagnostics, fixes, Normalize |
| `solver.js` | Parsing, propagation, solving, answer table |
| `Clue_to_GSL_PROMPT.md` | Prompt for translating natural language clues |
| `README.md` | This guide |

Saved in the browser: puzzle source, editor wrap preference, panel split, answer-table ordering, and the existing localStorage keys. No data is sent anywhere.

## Reference

**Long | Short:** right before/after | then/after; before | `<`/`then+`; beside | `adj`; apart | `~`; all different | `alldiff`; all same | `allsame`; exactly/atleast/atmost | `N`/`N+`/`N-`; DEFAULT UNIT | UNIT; total | sum; ordered circular | circular; braces | legacy pairing; each category | each tag.

When a phrase is ambiguous, do not rely on order or capitalization: quote the name or select the category with `.`, `'s`, or a tag suffix. This keeps programs deterministic and makes every repair explicit.
