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
Check the examples folder.
```
; 99 bottles of beer
!console.log @let {
  beer !? {
    0 "0 bottles of beer on the wall\n0 bottles of beer\nbetter go to the store and buy some more."
    1 "1 bottle of beer on the wall\n1 bottle of beer\nTake one down, pass it around"
    "{@x} bottles of beer on the wall\n{@x} bottles of beer\nTake one down, pass it around"
  }
  @unlines !*beer 99..0
}
```
