Wortel
======

Programming language that compiles to Javascript

# Sample
```javascript
:= fac &n?{
	<= x 2 		x
	*n !fac -n 1
}

:~`.innerHTML!getElementById 'output' ~!~`.join ', ' ~* &n "{n} -> {!fac n}" @to 10
```
