Wortel
======

Programming language that compiles to Javascript

# Examples
```javascript
; 99 bottles of beer
!console.log @let {
	beer &n@?n{
		0 '0 bottles of beer on the wall\n0 bottles of beer\nbetter go to the store and buy some more.'
		1 '1 bottle of beer on the wall\n1 bottle of beer\nTake one down, pass it around'
		"{n} bottles of beer on the wall\n{n} bottles of beer\nTake one down, pass it around"
	}
} `!.join '\n' !*beer @range [100 1N]
```
