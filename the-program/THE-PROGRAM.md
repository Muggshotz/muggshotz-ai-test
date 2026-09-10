# The Program
### Qyetstormn's Book of Spades

*A partnership language, not a book of tips.*

---

## What this is

Almost every book written about Spades is a tactics book: when to bid nil,
how to manage bags, how to cover your partner. This is not that.

This is a **specification for a language.** Spades forbids table talk, so the
only wire between partners is the card you choose *when you had a free choice*.
Most players spend those free choices on whatever wins the trick in front of
them. The Program spends them on information. Two players who both know the
system are reading each other's hands by the fourth or fifth card while the
opponents are still guessing — and the opponents cannot tell, because every
signal is carried by a play that looks like ordinary good technique.

**The objective function is not making your own contract. It is setting theirs.**

    Make a bid of 6     +60
    Set a bid of 6      -60      a 120-point swing, in one hand
    Make your own 4     +40

Setting the opponents is worth double making your own bid. And The Program was
built for games to **100**, not 500. At that distance a single set of a six-bid
is more than half the game gone in one deal, and ten bags is a threshold most
hands never live long enough to reach. Bags are noise. Sets are the game.

Everything that follows exists to manufacture sets.

---

## Chapter 0 — The hand that makes no sense

Opponents bid 6. Score essentially level. You are last to bid. Your partner,
who underbid his previous hand by three, has just bid **1**.

Your hand: the queen, jack and eight of hearts. Four clubs, all between the
seven and the ten. The jack, eight and three of diamonds. **No spades at all.**

You bid **nil**. It gets set. Your partner takes four tricks and says, angrily:

> *"You didn't have nil."*

Every reader will side with the partner. By the last page you will know that
the bid of 1 was a lie, that the nil was forced, and that the correct answer
to him was three words long:

> *You had four.*

---

## Part One — The Order of Leads

The **order of leads** is the priority list you use to choose which suit to
lead on your first *voluntary* lead — either because you sit to the dealer's
right, or because you have just won a trick and the lead is yours.

The word *voluntary* is doing real work. A forced lead is noise; you played
what you had to. Only a free lead carries a message, and both partners know
which is which. Opponents cannot tell the two apart, which means they cannot
tell when you are talking.

Because the list is **fixed and known to both partners**, a lead is not merely
a card. It is an **index into an agreed list**. Leading suit X says *I have X*
**and** *everything ranked above X was false*. One card carries the negation of
every condition higher in the triage. An opponent watching learns one fact.
Your partner learns one fact plus everything you just ruled out.

The signal costs nothing to send, because the signal **is** the correct play.

---

### Priority 1 — King, Queen, and at least two other cards

Lead the **King** from a suit in which you hold the King, the Queen, and **two
or more** additional cards.

    K              lead OK
    K Q            lead OK
    K Q x          ** NEVER LEAD THIS SUIT **
    K Q x x        lead OK
    K Q x x x +    lead OK

The floor is King, Queen, plus **two** spares. One spare is not enough.

**What partner reads.** When the King appears on your first voluntary lead, your
holding is a singleton King, or King-Queen exactly, or King-Queen with two or
more others. It is *not* exactly K Q x. He also knows you do not hold the Ace,
or you would have led it.

**Why K Q x is banned.** Your King and Queen cannot be captured by the Ace
unless you are the one who opens the suit. You are the only person who can hand
the Ace a clean shot at your honours.

Suppose you open it low and the player to your left holds A-5:

    Round 1   You lead the x
              LHO DUCKS with the 5 - a card that was never winning anything
              Your partner plays
              LHO's partner wins it cheaply from last seat

    Round 2   That partner leads the suit straight back
              You must play the King or the Queen
              The Ace takes it - and LHO is now VOID

King captured. Queen stranded behind a void that can trump it. **K Q x, opened,
is worth zero.**

Left alone, the same three cards are worth two tricks. Somebody else must broach
the suit eventually. When the Ace finally appears you drop the x underneath it,
and your King and Queen are the two highest cards remaining.

Look at what the duck buys the opponent. He surrenders a trick he was losing
anyway, and collects a cheap trick his side never bid, plus the Ace trick, plus
a void. His only risk is a defender holding a singleton in the suit — and
holding just two himself, he can price that: eleven cards across three hands
averages nearly four apiece. It is rare, and he knows it is rare.

That cheap trick is not a bag worth one point. It is a trick **subtracted from
the contract.** This is what a set-generating play looks like from the other
side of the table.

K Q x x survives the same treatment because the second spare lets you duck round
one and *still* have a card to throw on round two. You are never forced to feed
the Ace on their timing. The extra card is not padding — it is the card that
lets you refuse.

---

### Priority 2 — A lone card

If priority 1 does not fire, lead a suit in which you hold exactly one card —
the lone jack of clubs, the lone five of diamonds.

**What partner reads.** *I will be void here. Lead me this suit and I trump it.*
And by omission: *I have no King-Queen-plus-two anywhere in my hand.* One card,
apparently thrown away, describes a suit he can see and constrains three he
cannot.

It is invisible for the best possible reason. To anyone outside the partnership,
leading a lone jack looks *bad* — a weak or desperate lead by a player with
nothing. Opponents do not decode it because they have already filed it under
contempt. The signal hides inside their dismissal of it.

**The caveat, and where the bid enters.** There is a false positive: a 3-3-3-4
hand with no singleton, no length, and not enough low cards to risk nil. That
player is forced to lead something that looks like a naked lead and is not.

The fix is not another card convention. **It is the bid.** That player bids
**1** — *can't go two, don't dare go zero.* Partner therefore arrives at the
lead already knowing which reading applies.

Which means the bid is not a number in The Program. **It is a declared word.**
And **1** is the word for: *this hand is unplayable, expect nothing from me.*

Return to Chapter 0 and read the partner's bid again.

---

### The seating

Referred to throughout, and always relative to whoever leads the current trick:

    1st chair   the leader
    2nd chair   the player to the leader's west, acting immediately after
    3rd chair   the leader's PARTNER
    4th chair   the last player to act

Note what that means on your own lead: your partner commits in third chair,
**before** the final opponent. The last word — the cheap-trick seat — belongs to
them. Leading hands the opposition positional advantage on that trick, which is
itself an argument for leading suits you do not mind losing.

---

### Priority 3 — A suit you hold the Queen in. Do not lead the Queen.

If you have no lone card and no King-Queen-plus-two, lead **low** from a suit in
which you hold the Queen.

The exception: a Queen that is the sole card of its suit is a lone card, and is
handled by the lone-card rule above.

**Why not simply lead the Queen.** Leading her feeds her to whichever honour sits
above. You hand them a capture and collect nothing. The Queen stays home, hidden
behind low cards, while a low card does the work of drawing fire.

**What the low lead actually does.**

    You lead low from  Q x x

    2nd chair, wanting the trick, plays the KING
    3rd chair (partner) plays low
    4th chair must beat that King to take the trick - out comes the ACE

Their Ace and their King collide on a single trick. Two honours spent to win one
trick, and the highest card remaining in that suit is now in your hand. Your
Queen has been promoted to master, at the cost of a card that was never winning
anything.

That is the cheap trick. Not a trick you take — a trick you **manufacture** by
arranging for the opponents to beat each other.

**Why the Queen and no lower card.** Only two cards outrank her. That is the
shortest possible ladder above your card, which is what makes the collision
likely rather than wishful. With a Jack there are three cards above, and the
chance that the relevant ones crash together falls away sharply. The Queen is the
highest card you can hold that still has something worth clearing out above her.

**Never a suit you hold the Ace in.** This is the companion law, and it is
Priority 1 seen from the other side. Compare what your Ace does in each case:

    You LEAD the Ace   ->  you win a trick. Opponents discard trash.
                           Their honours survive untouched.

    You HOLD the Ace   ->  somebody else must open the suit eventually.
                           When they do, an opponent's King or Queen walks
                           into it. You win the SAME single trick - and
                           their honour is dead.

Identical value to you. Completely different cost to them. Leading your Ace wins
a trick and kills nothing; holding it wins a trick **and removes one from their
contract.** Held, the Ace is also your entry — the card that takes the lead back
when you want to steer.

So the two laws are one law, seen from both sides:

> **Never open a suit where opening it exposes your own honours to capture.**
> **Never open a suit where opening it forfeits your capture of theirs.**

You broach the suits where you have neither something to lose nor something to
catch.

**What partner reads.** Priorities 1 and 2 did not fire, so a low lead here says,
precisely: *I hold the Queen of this suit.* Not "something" — the specific card.
If he holds the King, he now knows the suit belongs to the two of you. If he
holds the Ace, he knows to duck and let the opponents crash into each other.

And by elimination, every suit you decline to open is a suit you may hold an Ace
in. Over a few leads your partner locates your Aces from cards you never played.

---

## Appendix — The record

Case's Ladder, Spades (Yahoo) ladder, handle `qyetstormm`. The searchable
record spans **2 Dec 1998 – 26 Apr 1999**: 1,381 opponent rows across 1,213
distinct games.

It is not a career record. It is a five-month window cut out of the middle,
bounded at the front by the day the Case's account was created and at the back
by the day people stopped bothering to report losses. It cannot show a
number-one run, for two reasons:

1. **The ladder is loser-reported.** Their rules: *"a loss must be promptly
   reported to the Ladder"*, and *"your opponents are not required to report any
   losses to you."* The better you play, the less of your record gets written
   down. A dominant pair at 1 and 2 generates the fewest rows of anyone.
2. **The window is a descent, not a climb.** In January the median rank was
   **8**, and **85% of games were against lower-ranked players** — from whom,
   by the ladder's own half-the-distance rule, no rank can be gained. The win
   rate rose across the window (55% → 62% → 65%) while the rank fell from 3 to
   2,618. Winning more, ranking less. That is a player taking all comers at the
   top, not a player climbing toward it. Median gap between consecutive games:
   240 seconds, with 301 games beginning within two minutes of the one before.

The first recorded day already shows rank 12, twenty-four minutes after the
account existed, against a rule that starts new members unranked at the bottom
— where another player on the same ladder duly entered at 2,694.

Whatever happened before 2 December 1998 is not in this record, and the record
itself says that is where it must have happened.

---

## A note on the games we gave away

We never threw a game and we never cheated. What we did was accept every
challenge. Anyone who wanted a game got one, and we played light — we were not
trying to farm rank off friends, we were passing the time at the top.

We also told people, plainly, that we did not care if *they* cheated. If you
and your partner want to text each other your hands, go ahead. People did it
anyway. It made no difference, and the reason it made no difference is the
whole thesis of this book:

**Knowing the cards is not the same as knowing what to do with them.**

An opponent pair with perfect information about each other's hands still has
to decide, on every trick, which card to play and why. The Program is not a
method for discovering cards. It is a method for two people to *act as one
player*. You can hand the other side full knowledge and they will still be two
people making two separate plans, while we are one player holding twenty-six
cards.

That is why we could afford to be generous about it. The information was never
the edge.

---

*Draft. Dictated by Qyetstormn; assembled as told.*
