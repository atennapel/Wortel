Wortel
======

Programming language that compiles to Javascript

# Sample
```javascript
[1 2 3] ~*: +\1; `map (+ 1) over the array

[1 2 3] ~*: (Math.pow)\2; `square the array

[1 2 3] ~*: x#:(x +: 1 (Math.pow): 2);

arr var: [1 2 3];
arr.0 +: (arr.1);
arr .concat: arr;

obj var: {a 1 b 2 c 3};
obj.a +: (obj.b);
obj.('a') +: (ob.('b'));

(..a)\*: [{a 1} {a 2} {a 3}]; `..a is a function that gets the a property.

1 +:& 2 +: 3; `& is like Haskell's $
```
