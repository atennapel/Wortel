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
} `!.join '\n' !*beer @range [99 0]

; Some Project Euler problems
; Problem 1
!/^+ !-&n||%%n 3 %%n 5 @to 999
; Problem 2
!/^+ !-\~%%2 @rangef [0 1] ^+ \~<4M
; Problem 6
@let {
  sq &n*n n
  l @to 100
} - !sq !/^+ l !/^+ !*sq l
```
