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

These are **positions, not people.** They describe the order of play on the
trick in front of you, and they rotate with every trick.

    1st chair   whoever leads
    2nd chair   the player to first chair's west - acts immediately after
    3rd chair   whoever plays third in the rotation
    4th chair   whoever acts last

Third chair is not "your partner." Third chair is third chair. Whose it is
changes every trick, and so does yours. When this book says *second chair* or
*fourth chair* it is talking about **when you have to commit relative to
everyone else**, and nothing more.

That is the whole reason the positions matter. Fourth chair acts with complete
information — three cards already on the table — and can therefore win as
cheaply as the trick allows, or decline it at no cost. Second chair commits
almost blind. The same thirteen cards are worth different amounts depending on
which chair you are sitting in when they have to be played, and much of what
follows is about arranging for your cards and your partner's to be spent from
the good chairs and preserved from the bad ones.

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

### The leader's duty

Before anything else about Priority 3, understand what the leader is actually
for.

**Your job when you lead is to protect your partner's bid, not your own.** You
can see your own cards; you already know roughly how you intend to make your
number. His plan is invisible to you. So every lead is a decision taken on
behalf of a hand you cannot read, and the question is never "what helps me" —
it is "what is least likely to wreck something he is counting on."

The entire order of leads follows from that. It is a list of the suits least
likely to damage a partner you cannot see, ranked.

### The cost of Priority 3, stated honestly

The low lead from a Queen suit can **trap your partner's King.**

    You lead low from Q x x
    Partner sits 3rd holding the KING
    The ACE sits 4th - behind him

Partner has to commit before the Ace does. If he plays the King, the Ace eats
it — and that King may be a trick he **bid.** The promotion play has then set
your own side.

And here is the answer, and it is the reason the rule exists at all.

**The Queen lead is a promise.** The lead itself is a sentence spoken to your
partner:

> *I hold the Queen of this suit. Play your King if the Ace has not shown.
> I have got your back.*

That is what makes it a **compromise** rather than a free roll. You cannot
broach a suit with zero risk to a hand you cannot see. So you pick the one suit
where you are able to **compensate** for the risk you are asking him to take.

Without that promise, third chair holding a King must play scared — the Ace may
be sitting behind him, so he ducks, and a trick the partnership owned is
deferred or lost to timidity. The Queen lead **unlocks his King.**

And look at the outcomes, because there are only two:

    Ace does not show          ->  partner's King WINS the trick outright

    Ace shows and eats the King ->  Ace and King are both dead,
                                    and your Queen is now master of the suit

**Either way the suit yields a trick to your side.** It is not a lead that is
likely to work. It is a lead that **cannot lose the suit** — which is precisely
what a man who cannot see his partner's cards ought to be choosing.

His King was never lost in the bad branch. It was **traded**, and the Queen
behind it collects the debt one round later.

Third chair still has judgement to exercise — his standing responsibility is to
make fourth chair pay as much for any trick as rational play allows, and there
are positions where the price is set highest by letting him have it cheaply so
that he must lead back. But the baseline instruction under this lead is not
caution. It is: **the King goes down if the Ace has not appeared.**

Which is the same law as the K-Q-x proof and the Ace rule, stated a third way:

> **An honour is only vulnerable when it must commit before the honour above
> it.** Everything in this system is about controlling who speaks first.

**This lead is not safe with an untrained partner.** An ordinary player in third
chair sees his King, sees his chance, and plays it — and the promotion becomes a
dead King and a broken contract. The lead is correct only because you can trust
the man in third chair to duck. It is also why a false bid is catastrophic
here: you are taking real risk to protect a contract, and if the contract was a
lie you are protecting nothing.

**What partner reads.** Priorities 1 and 2 did not fire, so a low lead here says,
precisely: *I hold the Queen of this suit.* Not "something" — the specific card.
If he holds the King, he now knows the suit belongs to the two of you. If he
holds the Ace, he knows to duck and let the opponents crash into each other.

And by elimination, every suit you decline to open is a suit you may hold an Ace
in. Over a few leads your partner locates your Aces from cards you never played.

---

### Priority 4 (last) — Ace-Queen or Ace-Jack

The bottom of the order, and the single exception to the Ace ban. If none of the
above is available, lead from a suit holding **Ace-Queen** or **Ace-Jack**.
An **Ace-King-Ten** is deferred on the same reasoning.

This lead sits last because two of the book's principles disagree about it, and
the order is how the disagreement gets settled.

**It is the safest lead in the book for your partner.** You hold the Ace, so his
King in that suit **cannot be captured** — the only card that beats a King is in
your own hand, and you will never play it on him. By the leader's-duty
principle alone this ought to rank near the top.

**It is the worst lead in the book for you.** First chair is the worst seat on
earth for a finesse. Everybody acts after you. The finesse requires the King to
commit *before* your Queen, and leading the suit yourself guarantees precisely
the opposite.

So you defer, and you hope the suit is opened by someone else — ideally by the
player to your west, which places you in the last chair:

    Suit led from your west. You act LAST holding A Q.

      King holder plays low    ->  your Queen wins. TWO tricks from the suit.
      King holder plays King   ->  your Ace takes it. Their honour is dead.

Only when nothing else is available do you open it yourself, accepting that you
have spent the finesse to make a safe lead.

**The bidding discipline that goes with it.** Holding A-Q you count the **Ace**
as a trick and the **Queen as a possible only.** You do not bid a finesse as
though it were already made. This follows from the bid being a declared word:
a word that assumes a finesse is a word that is not true yet.

**Why any of this matters.** *Finesses lead directly to sets.* A successful
finesse does not merely win you a trick — it kills their King. That is a trick
**subtracted from their contract**, not added to yours. The same arithmetic as
the duck in Priority 1, and the same as an Ace held in ambush. Everything in
this system is engineered to make the opponents' honours die without ever
winning anything.

---

## The order of leads, in full

    1.  King-Queen plus two or more others   ->  lead the KING
                                                 (never from exactly K Q x)

    2.  A lone card                          ->  lead it
                                                 (bid of 1 disambiguates)

    3.  A suit you hold the Queen in         ->  lead LOW, never the Queen
                                                 (the promise: play your King)

    4.  Ace-Queen or Ace-Jack                ->  last resort only
                                                 (A-K-10 deferred likewise)

    Never a suit you hold the Ace in, until rule 4 leaves you no choice.

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
