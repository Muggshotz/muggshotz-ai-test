# The Program
### Qyetstormn's Book of Spades

*A partnership language, not a book of tips.*

---

## The contention

> **Playing Spades correctly is more akin than anything to speaking a language.
> It is a series of signalling.**

Everything in this book follows from that sentence, so it is worth being precise
about what *kind* of language it is — because it is not the kind most people
picture when they hear the word.

Linguistics gives language two axes:

    X - the SYNTAGMATIC axis:   combination. How signs are strung together.
                                Grammar, sequence, word order.

    Y - the PARADIGMATIC axis:  selection. Which sign you chose out of the
                                set you could have chosen instead.

Ordinary speech runs on both at once. **The Program runs on the Y axis alone.**

It has to. The rules of the game forbid the other one — you may not combine
symbols at a Spades table, you may not sequence them, you may not talk. Every
avenue but one is closed. What remains is *choosing*, in full view of everybody,
from a list. So the choosing was made to carry everything.

There is no vocabulary here in the ordinary sense, and no grammar. There is a
known ranked set of options and a meaning produced entirely by which one was
taken. That is why leading the third suit on the list says *one and two were
false* — pure paradigmatic meaning. **The selection is the sentence.**

### Why there is nothing to intercept

This is the property that makes it unbreakable, and it is not secrecy.

**There is no message in the cards.** The meaning does not live in the King of
hearts. It lives in the *difference* between the King you played and the four
other cards you could legally have played instead. Take away the shared list and
the message is not encrypted — it stops existing, while every card on the table
remains a perfectly sensible play on its own terms.

Opponents are not failing to break a code. They are searching a place where
information was never stored.

Two other names for it, each catching a different face:

**Steganography.** Not the hiding of a message, but the hiding of *the fact that
a message exists*, inside a carrier that is completely meaningful by itself.
These are not ciphers dressed up as cards. They are cards that also happen to be
speech.

**A zero-cost covert channel.** Information travelling through a mechanism built
for something else entirely. Covert channels normally cost the sender something
— you do a slightly wrong thing on purpose in order to signal. This one costs
nothing, because the system was built so that **the signal is the correct play.**
You never pay to speak. That is the rarest property in the whole design, and
every rule in this book was chosen to preserve it.

> The Program is a language with no words and no grammar — only choices, made
> from a list both players know, in which the thing selected and the thing done
> are the same act.

### Every play is a message

And here is the consequence that closes off the escape hatch:

> **If you and your partner both share the code, every play is a message to your
> partner.**

Not the special plays. Not the conventions. *Every* play. There is no neutral
card, no throwaway, no quiet move — because your partner is reading against the
whole list, and what you did **not** do is as loud as what you did.

**You cannot decline to speak.** The only genuine choice at the table is whether
what you are saying is true.

That also settles the question of bandwidth. Most people hear "signalling
system" and picture a handful of conventions — two or three special plays that
carry meaning, and the rest of the hand as ordinary cards. This is not that.
Fifty-two cards go down in a hand and **every one of them transmits.** It is not
a set of signals embedded in a game. It is a continuous channel that also happens
to win tricks.

Which is the real reason the system cannot be half-taught. A partner who does not
know the code simply fails to *receive*. A partner who half-knows it **transmits
constantly, and most of it is noise** — and you will act on it, because you
cannot tell his accidents from his sentences.

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

## The two habits

These are done continuously, underneath everything else in this book, and they
are the easiest things in it to leave out of a book — because after enough years
they stop feeling like steps at all. They are not optional and they are not
advanced. They are the floor.

A word on that, because it applies to more than this chapter. Several of the
rules in this book felt too obvious to be worth writing down — and then I would
go to the tables and watch players violate them constantly and consistently. If
a thing is broken that often it is not intuitive; it was *learned*, long enough
ago that the learning has been forgotten. The embarrassment of writing something
down is a reliable signal that it belongs in.

### Habit one: COUNT SPADES

**Thirteen spades exist.** You can see yours. Every one that reaches the table is
subtracted, and what remains is the number that decides whether anything else in
this system still works.

Half the rules in this book are unenforceable without it:

**"Do not milk the cut"** cannot be obeyed unless you are tracking what your
partner has left. Stripping him bare is only avoidable if you know how close to
bare he is.

**"Run spades to break a crossfire"** requires the count both ways — to know you
can do it, and to know when it is being done to you.

**The crossfire itself decays.** Two voids in different suits are worth
everything at a trump count of nine and worth nothing at zero. The value of your
whole position is a pure function of trumps outstanding, so a player who is not
counting does not know what his own hand is worth.

**And your side-suit bosses are not tricks until the trumps are gone.** An Ace
with spades still live is a *hope*. An Ace after the last trump falls is a
*certainty*. Counting is what tells you which of the two you are holding.

That last point is the largest, because it means every hand contains a **phase
change** — one specific trick at which the hand stops being a ruffing game and
becomes a high-card game. Everything in every hand at the table revalues at that
moment. The player who is counting knows when it arrives. Everybody else finds
out afterwards.

**It is critical to know when you are no longer in danger of being cut.**

### Not just how many — who

A running total tells you the phase of the hand. Knowing **who is likely to hold
the remaining spades** tells you which particular opponent can still hurt you,
and that is the version you can act on. Being safe from the man on your left is a
completely different hand from being safe from the man on your right.

The estimate comes, above all, from **the voracity of their bid.**

A bid is the one signal every player at the table is *forced* to send, whether he
knows he is signalling or not. **You cannot bid big without trumps.** A man who
bids five has spade length or he is a fool; a man who bids one has almost none.
So every opponent — including opponents who have never heard of The Program and
never will — has already described the shape of the trump suit to you before a
single card is played, and will do it again every hand, because the rules of the
game compel him to.

### Why the trick number matters

The phase change is a moment you can be wrong about in **both** directions:

    Cash too early  ->  you are ruffed. The Ace you were saving dies for nothing.
    Cash too late   ->  the hand ends with winners still in your hand, unplayed.

The count, plus the map of who holds what, is what puts you on the correct trick.
Everybody else is guessing, and finding out afterwards which way they guessed.

### Habit two: KNOW WHEN A CARD IS BOSS

**I do not care if it is an eight. Know when a card is boss.**

This is not an instruction to count every card in every suit. Doing that while
also counting spades is extremely difficult and most players cannot manage both.
So do not track the *history*. Track the **state**:

    hearts     the 8 is boss
    diamonds   the jack is boss
    clubs      the 7 is boss
    spades     everything above the 9 is gone

Four facts, carried forward, updated whenever an honour falls. That is the whole
of it.

Not *"which cards have been played"* — fifty-two things to hold in your head.
Only **"what is boss now?"** — four. And it is the only question that has ever
mattered, because **a card's value was never its rank. It is the rank of what
remains above it.** An eight with nothing higher outstanding is not an eight. It
is an Ace, and it wins exactly like one.

### The two habits interlock

    Habit two  ->  tells you WHICH of your cards is boss
    Habit one  ->  tells you WHETHER being boss means anything yet
                   (a side-suit boss is only a hope while spades are live)

Together they give you the true value of everything in your hand, on every
trick. Neither one alone does it. That is why they are the floor and not the
finishing touches.

It is also the difference between a partner who is merely slower and a partner
who is unreachable. A player without this is holding a winning card and does not
know it. He will duck with a boss, or spend a trump protecting something that was
already unbeatable — and no amount of signalling can repair it, because you can
tell him what **you** hold and you cannot tell him what **he** holds.

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

**Why this outranks the lone card.** K-Q-plus-two is the one holding where
leading costs your side nothing. You are not exposing an honour to capture, you
are not forfeiting a capture of theirs, and you are not asking your partner to
risk anything. The lone card is powerful but it *spends* something. The
risk-free suit goes first.

**What partner reads.** When the King appears on your first voluntary lead, your
holding is a singleton King, or King-Queen exactly, or King-Queen with two or
more others. It is *not* exactly K Q x. He also knows you do not hold the Ace,
or you would have led it.

**Lead the King always. If it walks, lead the Queen. Then lead another suit.**

### The surplus — what the K-Q sequence really does

This is the heaviest lifting in the order of leads, and it is not a card play at
all. It is accounting.

**When you bid a K-Q suit you cannot count both honours.** You do not know where
the Ace is. One of them is going to die and you have no way of knowing which, so
an honest bidder counts that suit as **one trick** — forced by the same
discipline that counts an Ace but calls a finesse-dependent Queen a *possible
only*.

So when the King walks and then the Queen walks, that suit has delivered **two**
tricks against **one** counted:

    Counted from the K-Q suit        1
    Actually delivered               2
                                     ----
    Surplus                         +1

    Every OTHER trick he counted     still outstanding, still coming

Your partner has not yet spent one of his real tricks. He is a full trick ahead
of his own contract — and **you know it exactly.** Not as a guess. As arithmetic,
because you know what he was permitted to count when he bid.

A surplus trick is a free resource. It can cover you. It can be thrown at
killing a nil. It can absorb a bad break in another suit. It can pay for a risk
that would otherwise be reckless. Most partnerships never learn they had one
until the hand is over and they are counting bags.

**And this is why the bid must be honest.** The whole system is a ledger, and a
true count at declaration is what makes it readable. Surplus is only detectable
against an honest number. A partner who underbids does not merely cost you a
trick — he makes it impossible to tell whether an extra trick is a *surplus* or
merely a *correction to his lie.* The ledger stops balancing and every inference
downstream of it dies.

Which is why an underbid, and *"well, I had to make my tricks first,"* are not
errors of judgement. They are corruptions of the accounting.

### Worse than that: they are lies to your partner

Corruption of the ledger is the polite description. The true one is simpler.

**The only communication at that table that matters is the communication between
you and your partner.** Deception buys nothing against the opponents, because a
competent opponent has to play as though you hold the Ace whether you do or not.
They cannot afford the assumption. It is already priced in. Your falsecard tells
them nothing they were not already assuming.

Your partner is the only person at the table *trying to act on what you tell
him.* So a lie in this game has exactly one recipient, and he is on your side.

Leading the Queen when you hold the King. Leading the King when you hold the
Ace. These do not fool anybody but the man you need.

    You hold   A K of hearts
    Partner is VOID in hearts
    You lead the KING

    Partner cannot know where the Ace is.
    So he does the correct thing with the information he has - he CUTS it.

He has just trumped his own partner's winner. A trump spent, a trick stolen from
your own side, and his void — the thing the entire crossfire is built on — burned
for nothing. Three resources destroyed by one card.

**And it is on you.** He played correctly given what he knew, and you are the one
who chose what he knew. That is the accountability rule of The Program, and it is
the right one:

> A disaster caused by bad information belongs to whoever supplied the
> information, not to the partner who acted rationally on it.

Note that this is also why Priority 1 leading the King is not itself a lie. The
King lead is *defined* as denying the Ace. **The convention is the truth.**
Departing from it is the falsehood — and it is a falsehood that can only ever
reach one person.

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

**The Queen is held back as backup to your partner's King.** That is her entire
job in this rule — you keep her so that you have his back if his King is
sacrificed. Leading her forfeits the only thing she was being saved for.

The exception: **a Queen that is the sole card of its suit reverts to the
lone-card rule** and is led alone. There is no low card to lead, and a singleton
is a singleton whatever its rank. She keeps her robes on — but she goes out by
herself.

And lead her by all means, because holding her back preserves nothing. Under
ordinary bidding — no nil in the picture — a lone Queen has **exactly one** path
to winning a trick:

> Your partner holds both the Ace and the King.

That is the entire list. If either opponent holds either card she dies the
moment that suit is played, and it *will* be played, because she is your only
one. There is no line where waiting saves her.

So leading her is a **free probe**. You test the one condition under which she
lives, and if the answer is no you were losing her regardless — and you are void
either way, which was the real prize from the beginning. You cannot lose by
asking.

(No one wants to see a naked Queen. Cleopatra, possibly. Helen of Troy, at a
push. Galadriel would decline on principle — she is the one queen in the deck
who, handed absolute power, looks at it and does not play it.)

Which extends to the top of the deck. **A lone Ace is led too** — the one Ace
lead that is not a waste. A led Ace normally kills nothing, but a *singleton*
Ace takes the trick, voids the suit, and leaves the lead in your own hand.
Trick, void and tempo from a single card. The rank of a lone card does not
change the rule; the lone card is led.

The one thing that overrides this — and it overrides a great deal else besides —
is an opponent sitting nil. See that chapter.

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

## What the order is really building: the crossfire

Read as four separate rules, the order of leads looks like a list of safe
openings. It is not. It is an engine, and voids are what it manufactures.

**A singleton King that actually wins is worth double.** It is a trick *and* a
void, delivered by the same card. Ordinarily a lone King is a card you dread —
you have no choice but to play it the moment the suit is led, and it dies under
an Ace having achieved nothing. The order exists so that when it goes down, it
goes down under the best conditions available:

    Priority 3  ->  into a suit where the Ace has not shown
                    and your Queen is standing behind it
    Priority 4  ->  into a suit where the Ace is in YOUR OWN hand
                    and therefore cannot touch it

**And your Ace-Queen does not merely protect that suit — it releases your
partner from it.** He does not need to keep guards in a suit where you already
hold the top. His low cards there are dead weight and he can throw them freely.
So he voids himself in a *second* suit at no cost, because you are covering it.

    Suit A   solo King wins    ->  a trick taken, and partner is VOID
    Suit B   your A-Q covers   ->  partner sheds freely, and is VOID

Two voids on one side of the table. Now every lead the opponents make walks into
a ruff from one of you and there is no safe exit — whatever they open, somebody
trumps it. That is the **crossfire.**

Count what is actually left to them:

    Four suits. Spades is trump, so three side suits.

      You are void in one       ->  you trump it
      Partner is void in another ->  he trumps it
                                    --------------------
      Side suits neither of you can cut:      ONE

**Exactly one safe lead exists on the whole board.** Everything else they touch
is ruffed by somebody. And when that single suit is exhausted or blocked they
have no safe lead at all — every remaining option costs them a trick they have
already declared out loud. They are not losing tricks to better
cards. They are losing them to cards that are not in the suit at all, and every
one of those is a trick subtracted from a contract they have already declared
out loud.

Which reframes what the honours are for. They are not primarily trick-takers.
**They are cover.** They exist so that your partner can afford to become void,
and so that his honours can commit without dying. The voids do the killing. The
honours are what make the voids affordable.

### Why the voids must be in different suits

The crossfire maximises your partner's trumps and your own **without the two
conflicting.** That is the efficiency of it, and it is why the suits have to be
separate.

Two voids in *different* suits means neither of you ever ruffs a trick the other
one could have taken. Every trump is spent on a target only that hand could
reach, so the partnership's trumps are doing two jobs simultaneously.

Two voids in the *same* suit is waste. You are both queuing for the same ruffs —
one trump thrown away every time the suit appears, or worse, one partner
overruffing the other and spending two trumps to win a single trick.

### If you are caught in one

Crossfires almost always lead to sets. So when it is being done to **you**, it
must be broken up immediately, and there is only one way to do it:

**Run spades.**

A void is worth something only while the hand holding it still has trumps.
Strip the trumps and the void stops being a weapon and becomes an ordinary hole
in a hand. Delay, and you feed a ruff every trick while your own honours die
unplayed in your hand — which is exactly the shape of a set.

---

## The prohibitions

Plays you do not make. Not "prefer to avoid" — do not make them, unless the hand
leaves you no legal or sane alternative.

### 1. Never return the suit led by the player to your right

The player to your right acts **immediately before you** in the rotation. Which
means the instant *you* take the lead, he drops to the back of the queue:

    You lead   ->   you (1st) . LHO (2nd) . partner (3rd) . RHO (4th)

**He gets fourth chair — in the suit he chose to open.**

He led it for a reason. He has a tenace there, or he is developing something, or
he is hunting a particular card. Whatever the plan was, returning that suit hands
him the last word in his own project, with three cards face up in front of him
before he has to commit. You have taken the one suit at the table he had already
thought about and given him the best possible seat from which to finish it.

Understand what his lead actually was: **a request.** He was asking to get that
suit back. Return it and you have granted it — and you have given him the chance
to **survey the entire board** in exactly the suit he asked for. It is nothing
but asking for trouble.

The second half is worse, because your partner pays it:

    Partner must commit in THIRD chair - ahead of the very man who chose the suit

That is the leader's duty exactly inverted. The entire order of leads exists to
keep your partner from committing ahead of someone who knows more than he does,
and returning this suit walks him straight into it. You are not merely helping
the opponent; you are feeding your partner to him.

Same law as everything else in the book, stated as a prohibition: **arrange for
them to speak first, never for your side to.** Returning the right-hand
opponent's lead guarantees the opposite, on both counts, in one card.

---

## The rules of play

The order of leads governs your **first** voluntary lead. Once tricks are being
won and the lead is changing hands, a second set of rules takes over. The first
two are a matched pair — the same law seen from both sides of the table:

    Never grant the request of the man on your right.
    Always try to grant your partner's.

### Rule 2 of play — return to your partner's lead card

Your partner's lead was a sentence:

> *"I am out of these. Come back to me here."*

So return it. That is the default, and it is the opposite of the prohibition
above for exactly the same reason: his lead was a request, and this is the one
request at the table worth granting.

**Which side won the first trick changes what you are doing.** If your partner
took it, his first card is now information about his hand, and you read it before
you decide anything.

### But the order of leads still holds sway

**If you hold a lone card, void yourself instead of returning.**

This is the exception, and it outranks the return. Lead your singleton, go void,
and the board now has *two* voids on your side, in different suits — which is the
crossfire fully assembled.

**Why obedience is the riskier line.** Come back to his suit and let him cut, and
then what? He may not return your void suit — he cannot see it. Or he was never
void at all and that was merely his short suit, in which case there is no cut
coming. He goes somewhere else, and the board changes hands. Returning asks him
to guess about a card he cannot see. Voiding yourself asks him to guess nothing.

**And the switch is itself a message.** Changing suits on your partner tells him,
with certainty, one of two things:

    1. You are void in the suit you JUST LED - you led a lone card to make it so
    2. You are void in HIS lead suit

Your reply reads: *"Understood. But I am out of something too, so rather than
come back to you I am playing this — and now we are both out of a suit."*

Now **both of you know a suit the other is void in**, and that is the note to
make: come back to that suit at the first chance you get, no matter what.

### Which line to take

Two cases, and they do different things.

**If you hold the next boss in his suit** — you were coming back to that suit
anyway, so do it properly:

    1. Play the BOSS
       -> partner cannot follow, so he DISCARDS
       -> that discard moves him toward a second void, free of charge

    2. Now play LOW in the same suit
       -> and he takes his cut

**If you do not hold the next boss, but you hold a lone card elsewhere** — take
the lone card over the return. Void yourself, tell him where you are void, and
come back to his suit later.

### Do not milk the cut

There is an exception and a hard limit attached to it.

If you hold **all** the bosses in a suit and therefore do not need his cuts at
all, you may run spades, or run low cards in that suit to let him cut.

**Only do this once.**

Do not keep running his cut suits at him. Every ruff you feed him **spends one of
his trumps**, and if you keep feeding you will strip him bare — and then lose a
suit you held the boss in, purely because you were busy handing out free cuts.

    A ruff costs your partner a trump.
    A discard costs him nothing.

So when you have the choice, **play the boss and let him dump another suit**
instead. The discard builds the second void at no cost to his trump holding. The
cut spends the very resource the crossfire runs on.

---

### Rule 3 of play — trust your partner

This is the reciprocal of the leader's duty, and the book needs both halves or
neither works. The leader is obliged to protect a hand he cannot see. **Third
chair is obliged to believe that he did.**

The instruction is uncompromising:

> **When your partner leads a suit — particularly a spade — never give fourth
> chair a cheap win. Make it expensive, or win the trick outright if you can.**

Fourth chair sits in the best seat at the table with three cards face up in
front of him. Play small and he takes it with something small, and the opponents
have collected a trick for nothing. That is the one gift you must never make.
Especially in spades, where a cheap trump trick is the most expensive thing you
can hand away.

Which means putting your King down with the Ace possibly sitting behind you.

**You do it anyway.** Your partner chose that suit, and the entire order of leads
exists to make that choice safe for you. Sometimes the King dies regardless. That
is the premium on the policy, not evidence against it — and the accountability
rule already says whose it is: *the death of that King belongs to whoever led
blind, not to the man who trusted the lead.*

### And if he cannot be trusted

> If he does this consistently — get a new partner.

That is structural, not bitterness. A system whose signals are **commitments**
takes trust as an input. You cannot compensate for an untrustworthy partner by
playing better, because playing better *means acting on what he tells you.* There
is no defensive crouch available inside this system. Either he can be believed or
the system is switched off.

A partner who cannot be believed is not a weakness to be played around. He is a
defect with no patch.

---

## It Changes Everything

A nil changes everything, because the nil becomes the priority — and **the
recognition has to be immediate.** The moment it is on the table, the hand you
were about to play is not the hand you are now playing.

### Your bid stops mattering

    The worst set you can possibly take  =  your bid x 10.   FINITE.
    A game-winning nil                   =  the game.        TERMINAL.

You can come back from points. You cannot come back from the game being over.

So once the nil is the thing that ends it, **every card in your hand is free.**
Sacrifice every King you hold. Take a set of eight books. None of those are real
costs, because every one of them is paid in a currency that only means anything
if there is going to be another hand.

> **It must be stopped at all costs, by any means necessary.**

**The one caveat, and it is a real one.** Sometimes the nil is *not enough* — it
will not win them the game even if they make it. In those hands, do not worry
about it. Play your own hand and take your own tricks.

But in a game to 100 that condition is met almost every time, because a hundred
points **is** the game. Which is why the doctrine reads as absolute in practice,
and why a partner who treats it as a judgement call is so maddening: he is
weighing his forty points against a thing that is not measured in points at all.

### The arithmetic that governs it

    Opponent bids nil and MAKES it        they score  +100
    Opponent bids nil and you SET it      they score  -100
                                          -----------------
                                 the swing:            200 points

    Your own contract of 4, made                        +40

Which is why *"well, I had to make my tricks first"* is not a difference of
opinion but an arithmetic error. That player is defending forty points while
conceding two hundred. **Stopping the nil is worth roughly five times his entire
bid** — and in a game to 100, a made nil is not a setback, it is the game. In
most situations, if you do not stop the nil your tricks do not matter. They are
rounding error beside the thing that was ignored.

The nil also suspends parts of the order of leads — the lone-card lead among
them. And there is a psychological mechanism to it that needs its own treatment.

### The two of spades

**Against a nil, the two of spades is perhaps the most valuable card in the
deck.** And for the first nine tricks it looks like the least valuable card in
the deck, which is precisely why people throw it away.

Understand what makes it a weapon: **the deuce is the only spade that cannot win
a trick.** Which is exactly why it can force somebody else to. Lead it, and any
spade in the nil bidder's hand beats it. He must follow. He must beat you. He
takes the trick — and the nil is dead.

Unless somebody covers him. Which is what the bleeding is for.

### Never lead an Ace into a nil

In something like twenty to thirty million hands of spades I have never once quit
on a hand and walked out of a room. Nothing has ever come closer to making me do
it than a partner who comes out leading Aces while an opponent is sitting nil.

Look at what the two leads do:

    You lead a LOW card  ->  the nil may be forced to play over it and WIN.
                             That is the entire object of the exercise.

    You lead an ACE      ->  you win the trick, guaranteed.
                             He safely discards his most dangerous card.

**Every Ace you lead against a nil removes one of his danger cards for free** —
and you pay for the privilege with the best card you own. That is not a failure
to attack him. It is doing his laundry. Three Aces led is three high cards
cleaned out of his hand that could have hanged him, and he never had one anxious
moment.

It is worse than a wasted trick, too, because that Ace was also the card that
could have *forced* him later, or served as the entry you needed to set the deuce
up. It is not one mistake. It is spending your best weapon to disarm yourself on
his behalf.

Which makes this the sharpest form of a rule already in this book — *never open a
suit you hold the Ace in.* Against a nil it stops being a preference.

### The view from the nil's seat

And if you want the proof without any of the reasoning, look at the same fact
from inside the hand you are trying to beat:

> **Most of the time when you are nil, you are sitting there begging that
> someone — anyone — please start leading Aces.**

Everyone who has ever bid nil knows that feeling. The whole hand spent hoping
somebody will start cashing high cards so you can throw your problems away in
safety.

That is what your partner is doing for the opponent. He is granting the exact
prayer you would be saying in that seat.

**For your own partner to do it is like a slap in the face.**

And it is worth understanding why it lands that way rather than as an ordinary
misplay. This book established early that *every play is a message.* So in this
system a bad play is not a neutral event occurring on the table. It is something
**said to you**, by the only person there who is talking to you at all. An Ace
led into a nil does not merely lose the hand — it tells you, in the language the
two of you share, either that he does not know the code or that he is not with
you.

You cannot take it impersonally. The medium was never impersonal.

### The only thing anyone has to remember

Everything in this chapter can be replaced by one question:

> **What are you hoping the opponents do when you are the one sitting nil?
> Whatever that is — do not do that.**

It is better than a rule. It is a **generator**, and it produces every specific
instruction here without anyone memorising a thing:

    You pray for Ace leads                     ->  never lead an Ace
    You pray somebody takes a trick off you
      cheaply                                  ->  never take one off him cheaply
    You pray nobody leads low into you         ->  lead low
    You pray his cover is never made to burn   ->  make the cover burn

It also covers the positions this book never got round to listing, which no
finite set of rules can do.

And it requires no study whatsoever. Everyone who has ever bid nil already holds
the complete table of answers, stored as a **feeling.** You are not being asked
to learn anything here. You are being asked to remember.

It is the inverse of the golden rule:

> ### Do unto others exactly what they are hoping you don't do.

Or, said the way that shows you how to actually work it out at the table —

> ### Do exactly what you would hope they don't do, if they were you and you were them.

Which requires no mind-reading at all. You are not guessing at his hopes. You are
swapping seats and consulting your own.

---

### The bleeding — and it is not what it sounds like

The man you are bleeding is **the nil bidder's partner.** He is the cover. He is
the only reason the nil survives at all, and every trick the nil bidder is about
to be stuck with, that partner has to come and rescue him from.

**You do not strip him by leading spades.** Leading trumps is a *gift* to him —
it lets him shed his small spades cheaply and keeps his high ones intact for
precisely the moment you needed them gone.

**You strip him by forcing him to cut.** Put the nil bidder in a position where
he is about to win a middle trick, and the partner has no choice: he must ruff to
take it off him. That spade is spent on your terms, on a trick you chose, and it
has to be a real one — big enough to actually win — not a throwaway.

Which makes every attack on the nil a **free roll**:

    He fails to cover     ->  the nil is SET. Hand over.
    He covers by ruffing  ->  he is one spade poorer, and you go again.

There is no third outcome and no cost to you. You keep squeezing until either the
nil dies or the cover is out of trumps.

    1. Force cuts until the cover has no spades left

    2. Then lead the deuce
       -> the nil bidder must play a spade, it must beat the deuce,
          and there is nobody left to come and get him

By that point it is not a card. It is an execution.

### A worked hand

Your hearts: **A Q 7 4 3.** The nil bidder is on your right. His partner — the
cover — is on your left, and you know or suspect he is void in hearts and
cutting.

**Do not lead the 3.**

    lead the 7   ->  the cover must ruff.  Spade #1 spent.   You keep 4, 3
    lead the 4   ->  the cover must ruff.  Spade #2 spent.   You keep 3
    lead the 3   ->  the cover must ruff.  Spade #3 spent.

The order is the entire lesson, and it looks arbitrary until you see what it is
protecting. **Every heart you lead, you keep the ones below it.** Lead the 3
first and it dies under a ruff having achieved nothing, and your lowest heart is
now the 4. Lead from the middle downward and you arrive at the kill still holding
the smallest card you own.

Three of his trumps are now gone, spent on tricks *you* chose. Even a good hand
usually holds about four spades, so he is down to one — his Ace — and he is not
spending that on you.

### Then dump the high spades around the nil

The cover is down to his Ace, and notice that his last spade is not really a
choice any more. He will not cut with it — spending the Ace of spades on a ruff
is throwing it away — so the only thing left to do with it is **lead** it. And
the instant he does, he is dry.

Meanwhile you and your partner do the same thing on purpose. **Dump the high
spades around the nil.** Feed each other things to cut, spend your own big
trumps, get them off the table.

Because the nil bidder's spades are only harmless while bigger ones still exist.
He does not have to be holding a good spade — he only has to be holding **the
best remaining one.** And that is a condition you manufacture by emptying the
other three hands, not something you hope for about his.

    Every high spade gone from the other three hands
        -> whatever the nil is still holding is now the biggest thing on the table
        -> he cannot avoid winning with it

    That is the set.

The prettiest version of the ending is the one where **your own last spade is the
deuce.** Lead it and he must beat it; there is no card in the deck he can duck
with. But that is the best case, not the requirement — the requirement is simply
that nothing above him is left anywhere else.

Which is the real reason behind the rule. It is not superstition about a small
card. The deuce is the closing move of a plan that takes the entire hand to
build, and cutting with it early throws away the ending.

> **Never cut with the two — or only if it is the last.**

---

## Handcuffing

Everything above is one track. There is a second, and the great advantage of the
position is that **you do not have to choose between them early.** Work the nil,
and if it starts to look unsettable, pivot — and go set their *bid* instead. Same
cards, same seat, no commitment required.

### Why the cover is helpless

A proper nil cover has to husband his high cards. He cannot spend a King on a
medium card, because if he does he is left holding only low ones and cannot cover
his partner later, which is the single job he has.

And here is the engine, which most players never notice: **the nil bidder's play
carries no information.** He always plays his lowest card. Always. So when he
follows suit, the cover learns *nothing* about what else his partner is holding —
a nil sitting on the Queen and a nil sitting on the 3 look exactly alike from
across the table.

The cover is therefore permanently guessing, about the one thing he cannot afford
to be wrong about.

### The technique

    You hold  Q J 7 4 of clubs
    The nil is on your LEFT   - he follows you immediately
    The cover is on your RIGHT - he acts LAST, holding the King

    You lead the JACK - the LOWER of your sequence - and keep the Queen.

    The cover's problem:
      Take it with the King  ->  if the nil holds the Queen he is naked later
      Duck                   ->  you steal the trick

    He ducks. He has to. You win a trick with the Jack while sitting on the
    very Queen he was afraid of.

**And notice it works even though he acts last.** Acting last normally means full
information. But the one fact he needs is not on the table, because **the nil's
card tells him nothing** — his partner follows with a small club, exactly as he
would whether he held the Queen or the 3. The cover is sitting in the best seat
at the table and is still blind about the only card that matters to him.

### What the handcuff actually buys

Not the stolen trick. **Time** — and a restraint that stays on as long as you
decline to spend it.

### The two modes, and they contradict each other

This is the part that must not be got wrong, because the two lines of attack give
**opposite instructions about the same cards.**

    SETTING THE NIL     ->  DUMP your high spades around him,
                            so that his become the biggest thing left

    SETTING THE COVER   ->  HOARD your high spades,
                            because a high spade held is a standing
                            restraint on every book he wants to take

Playing the wrong mode is not a small error. It is doing precisely the opposite
of the correct thing with every trump you own.

**Why you hoard in cover mode.** Same principle as everything else in this book:
*the threat is worth more than the execution.* A high spade still in your hand
means none of the cover's winners are ever safe — he cannot cash, cannot run
trumps, cannot relax. Ruff with it and you have bought one book and handed him
his freedom back. It is the deuce again, and the held Ace, and the Queen kept as
backup. **Spent, it is a trick. Held, it is a leash.**

So your partner does **not** cut the cover's King with the King of spades. He
recognises that you have switched from setting the nil to setting the cover, and
he saves his high spades to go on handcuffing with you.

### How the switch is actually signalled

There is no card that means *"I am changing plans."* Nothing on the list says it,
and no convention covers it. So the message is carried by the **list itself.**

> **You take a trick LOW, in a spot where the rules oblige you to take it HIGH.**

Rule 3 of play is mandatory: never give fourth chair a cheap win — take it
expensive, or take it outright. So a deliberate low take, in a position where
high was compulsory, **cannot be an accident** between two players who both know
the rule. It can only be a sentence.

That is the whole trick, and it is the paradigmatic axis taken all the way down.
The vocabulary is not the cards. **The vocabulary is the rules**, used as a
background against which a deviation means something. Meaning out of the
difference between what you did and what you were supposed to do.

And it hides where everything else in this book hides — **inside their contempt.**
An opponent sees a weak take. Timid. A misplay. He files it under *he blinked* and
moves on, because reading it would require knowing that the low take was
forbidden.

Your partner reverses his spade policy on the spot. He is not merely decoding
what you hold any more; he is decoding what you have **decided to do with it.**

The general form: **lead into the cover, past the nil, out of a sequence in which
you hold the middle cards and he holds the top one.** He owns the best card in
the suit and is structurally forbidden from playing it, because playing it might
cost him the ability to do his job.

That is the handcuff. He is not beaten. He is *restrained.*

### Why this is not a consolation prize

**Their nil is what creates the handcuff.**

Bidding nil does not merely put a hundred points at risk on the nil itself. It
**structurally disables their defence of their own contract**, because one of
their two players now spends the hand hoarding cards instead of taking tricks.

So the pivot is not what you fall back on when the nil survives. It is a second,
independent line of attack that their own bid opened up for you — and it is
available from the first trick, whether you end up needing it or not.

> **Never cut with the two of spades while an opponent is nil.**

Ruffing with it trades the hand's decisive card for one ordinary trick — and
people do it early, automatically, precisely because the deuce *looks* like
rubbish for the first two thirds of the hand. Its entire value is deferred to the
tenth or eleventh card.

**The one exception:** if the deuce is your *only* spade, it cannot do the job —
you have nothing to bleed with and no way to set the position up. In that case
get rid of your spades.

---

## They thought we were cheating

We heard it constantly. Every day. *There is no way in the world you could have
known to play that — you must be cheating, you must be on the phone with him.*

They were right about the important half. Information really was moving between
us, in quantities that should not have been possible across a table where nobody
is allowed to speak. They simply had the wrong channel. The way he played
triggered my knowledge of what was in his hand.

But the thing that convinced them was never a single clever play. It was the
**turn.**

We made it at the same time. Both of us recognising the same moment — the trick
at which the bid had made itself vulnerable — and both switching from setting the
nil to setting the bid, together, without a word.

A message did pass. It simply was not in a card.

It was a **trick taken low where the rules demanded it be taken high** — a
deliberate breach of a mandatory rule, which between two people who both know the
rule can only be deliberate, and therefore can only be speech. That is why no
observer ever found it. They were watching the cards. The message was in the gap
between the card and the rule.

And it is exactly why it looked like a phone call. There is no innocent
explanation available to a spectator for two people changing plans in unison
without speaking. They could see the effect, and they knew of only one mechanism
that produced it.

### The complete read

The best of it came near the end of a hand.

Six cards left. Some seemingly inconsequential discard — a card that mattered to
nobody watching — and suddenly **the complete read was in.** Both of us knew
every card that was going to fall and exactly how the hand would close. There was
nothing left to decide. The hand had stopped being played and started being
executed.

And one of us would type, out loud, in front of everybody:

> *"lol — good job"*

He knew it was over. I knew it was over. And those three words are the only
speech in this entire system — spoken in plain English, in public, to a room full
of people, and completely undecodable, because they carry nothing whatsoever to
anyone who does not already know everything.

It was almost like telepathy. It was not. It was a list, memorised by two people,
and a discard nobody else thought was worth looking at.

It was not cheating. It was something built out of nothing but public information
and a list we had both memorised — which happened to leave the same signature.

And the part a lesser pair never reaches: **we were still safe for another hand.**
Pivoting off the nil to take the bid never put our own number at risk. We did not
gamble the contract to make the attempt.

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

*Draft. Dictated by Qyetstormn; assembled as told.*
