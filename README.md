Wortel
======

Programming language that compiles to Javascript

# Sample
```javascript
:= fac &n?{
	<= x 1 		1
	*n !fac -n 1
}

:`.innerHTML!document.getElementById 'output' ~! ', ' `.join ~*&n "{n} -> {!fac n}" @to 10
```
