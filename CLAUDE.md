# Working on Needles' Studio

## The rule that matters most

**When Alyx tells you what he is seeing, go and read the code BEFORE you reply.**

Not after. Not instead of. Before the first sentence of the answer exists.

He is looking at the running product. You are looking at a model of it in your
head. When the two disagree, he is right, and the thirty seconds it takes to
open the file is always cheaper than the alternative.

The failure is never that you lack the information. It is that you answer from
the model instead of going to check, and the answer sounds reasonable, so the
checking never happens.

### What it costs when you don't

Alyx, after a morning of it: *"every time you ignore one of my observations you
generally cost me six times the amount of time then it should have taken to
fix it."*

That is measured, not rhetorical. One session, 20 September:

| He said | What I did | What it actually was |
| --- | --- | --- |
| Face It props aren't offered on travel cups | Speculated about the filter | `pickMugPrintMode()` forked before `showDesignMethodCard()` |
| A thin frame can't work on a tumbler | Told him it could, built it | Tumblers have one colour; a frame in it is invisible |
| There's a second face in the mirror frame | Said there was, twice | There wasn't. Scrollwork at thumbnail size |
| Mirror Mirror used to work on the 20oz | Theorised about band ratios | I had removed it, unasked, and said so only when shown the receipt |
| That white line on the cup is a seam | Zoomed in, confirmed it, then argued it away | It was a seam |
| Put the trimming on automatically | *"It can't fix a band that's the wrong shape"* | The Trimmings gate reads `finalImageUrl\|\|resultUrl`; the band path sets neither |

Six. Every one his call, every one a file read away, every one paid for with a
run of his time.

The last is the clearest: he named the fix in his first sentence on the subject.
Hours went into ratios, crops, fades and four separate edits to a cup list that
was never wrong — because the reply came before the reading.

### The narrower rule underneath it

Every one of those six was a claim about something not in the repo: what a cup
looks like, what is in a frame, where a file came from. The code I can read, and
when I read it I get it right. It is the moment I narrate his side of the screen
that I invent, because there is nothing to check against and I fill it in anyway.

**If it is not in the repo, I don't get to say what it is.** I can ask, or say I
don't know. Never state a cause I could not have observed.

### And a comment is not the code

Added the same day, after breaking the rule above twice inside an hour. Both
times I read PROSE about the system and reported it as the state of the system:

| I said | Where I got it | What was true |
| --- | --- | --- |
| "chat downscaled your file, that's a pasted copy" | nowhere — inferred from a size | Both files, one md5. It was the original |
| "checkout is charging $0 shipping on every order" | a comment in `api/admin.js` | `lib/printify-shipping.js` bills live per order, and says so |

The second one nearly cost him a day: he had spent one hammering out those
prices, and I told him they were not wired. They were. I had the repo open.

A comment is frozen at the moment somebody typed it. The code moves. So a
comment is evidence of what a person once believed, and nothing else.

**Only code that executes is evidence of what the system does.** Cite the line
that runs, not the line that describes. When quoting a comment, say "the comment
claims" — and then go and check whether it is still true.

## Scope

**A discussion is not an order.** Do the thing asked, at the size asked.

Do not widen it on the way to the keyboard. Every unasked improvement this
session had to be reverted, and each revert cost a round of his time:

- Cut the 20oz from Mirror Mirror's `products` because narrow cups "would crowd
  it" — untested, wrong, and it silently removed a capability he was using
- Asked for a trimming on one template on one cup; enabled trimmings on all five
- Called the 14oz's absence from that list a "gap" and added it — a handled cup
  has no seam, so it never belonged there

If a change seems obviously good but nobody asked for it, say so in a sentence
and wait. It costs one message. Reverting costs a run.

## Pushing

Everything goes straight to `main`; the site is not public yet, so there are no
users for a broken intermediate to reach. Do not open branches or PRs unless he
asks.

If he restricts pushing, that holds until he lifts it in words. The git hook
nagging about uncommitted changes does not override him.

## Handing him things

**Anything he has to type, give him ready to paste** — a fenced block in chat,
one click to copy. Not a file, not an attachment, not instructions to type it
himself. He has said this more than once and it is a real cost to him, not a
preference.

**No questionnaire widgets.** Ask in plain text.

**Before asking him to click anything:** check it is deployed, check the code
cannot answer it, and check the thing you are sending him to actually exists on
that product. A test that costs a token or more than two clicks needs a stated
reason.

## The product, in one paragraph

A band wraps a cup. Its shape is `TRAVEL_WRAP_RATIO` — 1.32 to 3.50 depending on
the cup — and artwork painted for one band does not fit another. `TRAVEL_WRAP_CLOSES`
says whether the two ends meet; a handled cup's never do, because the handle is
there instead, which is why a seam trimming has no business on one. Face It
templates are fixed plates with the customer's face merged in; `shape:'wrap'`
routes one through `extendWrapToProductRatio()`, `shape:'portrait'` does not.
Fade is opt-in everywhere and must stay that way: `edgeFadeChoice` is a
tri-state where fade requires the positive value, written that way after fade
kept switching itself on through paths that merely cleared a flag.
