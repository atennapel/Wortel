Wortel
======

Programming language that compiles to Javascript

# Examples
```javascript
;	All the operators are prefix and have a fixed number of arguments,
;	like a reversed RPN language or a LISP without the parentheses.
+ 1 1
* 2 3
+ 1 * 2 3
++ 1 2 3

; Some more examples
@var {
	fac &n?{
		<= x 1 		1
		*n !fac -n 1
	}
	fac2 &n !/^* @to n
	fac3 @[\!/^* ^@to]
	isPrime &n?{
		<= n 1 	false
		= n 2 	true
		@none \%%n @range [2 -n 1]
	}
}

:`.innerHTML!document.getElementById 'output' ~! ', ' `.join !*&n "{n} -> {!fac n}" @to 10
```
