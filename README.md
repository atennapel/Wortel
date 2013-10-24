Wortel
======

Programming language that compiles to Javascript

# Examples
```javascript
@comment "
	All the operators are prefix and have a fixed number of arguments,
	like a reversed RPN language or a LISP without the parentheses.
"
+ 1 1
* 2 3
+ 1 * 2 3
++ 1 2 3

@comment "Some more examples"
@var {
	fac &n?{
		<= x 1 		1
		*n !fac -n 1
	}
	isPrime &n?{
		<= n 1 	false
		= n 2 	true
		@none \%%n @range [2 -n 1]
	}
	fac2 \!/^*
}

:`.innerHTML!document.getElementById 'output' ~! ', ' `.join !*&n "{n} -> {!fac n}" @to 10
```
