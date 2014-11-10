# Operators
All operators have a fixed arity, precedence and associativity.
Operators should partial apply and compose automatically if
less arguments than their arity are given or if they are given
partial applications or compositions themselves.

```
+1
	x -> x + 1
1 +
	x -> 1 + x
1 + (* 3)
	x -> 1 + (x * 3)
```

Any operator prefixed with ~ should reverse it's arguments.

```
a - b
	a - b
a ~- b
	b - a
```

Any operator prefixed with a . should be turned in to a
method call on it's first argument.

```
a .+ b
	a.add(b)
a .+
	x -> a.add(x)
a .~+ b
	b.add(a)
```

A . will turn it's caller in to a partial application

```
1 + .
	x -> 1 + x
f(a . c)
	x -> f(a, x, c)
```

Any operator prefixed (or suffixed?) with : should be turned in to an assignment.

```
a :+ b
	a += b
a :%% b
	a = (a % b == 0)
a :& b
	a = Math.min(a, b)
```

# Names
Any name prefixed with a @ should turn it's caller in a mapping function.

```
@a + 1
	map(x -> x + 1, a)
@a + @b
	flatzip((x, y) -> x + y, a, b)
f(@a 1)
	map(x -> f(x, 1), a)
isPrime: x -> x = 2 || (x > 2 && sum(x %% [1..x]) = 2)
	...Prime checker...
```

# Composition

```
Composition
	@[f g h]
		f(g(h(x)))
Fork
	@{f g h}
		g(f(x), h(x))
Fork of length 2
	@@{f g h}
		g(f(x, y), h(x, y))

# Do-notation
```
do [
	<- setTimeout(. 1000)
	<- setTimeout(. 1000)
	alert("2000ms later")
]

do [
	x <- ajaxRequest1
	y <- ajaxRequest2
	? {
		y > 0 do [
			a <- ajaxRequest3
			alert("a")
		]
		alert("b")
	}
]
```

# Macros
Macros and user defined operators could be added,
but only if they are scoped.
