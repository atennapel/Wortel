Miro
======

Programming language that compiles to Javascript.
This is the next version of Wortel.
I renamed it, since this version is quite different syntactically.

# Goals
* Optimized compiler
* Automatic partial application and composition
* Clean tacit programming
* Better chaining
* JS call and index syntax

# Example
```
Miro 0.2 REPL
> 1 + 2
(1 + 2)
> 1 +
function(_0) {; return ((1 + _0))}
> Math.PI * 2 *
function(_1) {; return ((((Math . PI) * 2) * _1))}
> :: Number * 2
function(_2) {; return ((type(_2, Number) * 2))}
> @_(+)
function(_3, _4, _5) {; return (_3((_4 + _5)))}
> @_(@_)
function(_6, _7) {; return (_6(_7))}
```
