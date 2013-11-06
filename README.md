Wortel
======

Programming language that compiles to Javascript

# Usage
## REPL
```
node Wortel
```
Use setModeEval and setModeParse to switch between eval and compile modes.
## Execute file (in nodejs)
```
node Wortel input.wortel -r
```
## Compile
```
node Wortel input.wortel > output.js
```

# Examples
```javascript
; 99 bottles of beer
!console.log @let {
  beer &n@?n{
    0 '0 bottles of beer on the wall\n0 bottles of beer\nbetter go to the store and buy some more.'
    1 '1 bottle of beer on the wall\n1 bottle of beer\nTake one down, pass it around'
    "{n} bottles of beer on the wall\n{n} bottles of beer\nTake one down, pass it around"
  }
	`!.join '\n' !*beer @range [99 0]
}

; Some Project Euler problems
; Problem 1
@sum !-&n||%%n 3 %%n 5 @to 999
; Problem 2
@sum !-\~%%2 @rangef [0 1] ^+ \~<4M
; Problem 6
@let {l @to 100 - @sq @sum l @sum !*^@sq l}
; Problem 14
~@maxf @to 1Mj &x #@rangef x &n?{%%n 2 /n 2 +*n 3 1} \~>1
```
