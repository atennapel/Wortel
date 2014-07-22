Wortel
======

Programming language that compiles to Javascript

Try it out at: http://atennapel.github.io/Wortel

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
Check the examples directory.
```
; 99 bottles of beer
!console.log @unlines ~!* 99..0 !? {
  0 "0 bottles of beer on the wall\n0 bottles of beer\nbetter go to the store and buy some more."
  "{@x} bottle{@?@x{1 @e 's}} of beer on the wall\n{@x} bottle{@?@x{1 @e 's}} of beer\nTake one down, pass it around"
}
```
