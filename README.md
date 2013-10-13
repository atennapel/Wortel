Wortel
======

Programming language that compiles to Javascript

# Sample
```javascript
# Euler 1
iota: 999 ~%`%: [(% !>: 3 @: !) (% !>: 5 @: !)]`@*:
	||`!*: ~%: (iota: 999) ..(0)`-: ..(1)`*: /+:;
# Euler 2
(~~ @: ~+`% [id (slice !<: -2 @: /+)]`@ ~&) !^: 32 ,: [1 1] even`-: /+:;
# Euler 4
100 range: 1000 ~^`%: *`!*: ([str (str @: ..(split: '' .reverse: .join: ''))]`@ @: =`!)`-: max`!:;
# Euler 5
{
	gcd {gcd a b}\(b =: 0 ?: a (b gcd: (a %: b)))
} let: (iota: 20 ~/`~: [a b]\(a *: (b /: (a gcd: b))));
# Euler 6
(iota @: (~~ @: ~+`%) [(/+ @: *`%) (*`%* @: /+)]`@ -`!): 100;
```
