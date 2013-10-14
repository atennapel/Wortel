Wortel
======

Programming language that compiles to Javascript

# Sample
```javascript
[1 2 3] .map: +`1;

[1 2 3] .map: (Math.pow)`2;

[1 2 3] .map: x\(x +: 1 (Math.pow): 2);

arr var: [1 2 3];
arr.0 +: (arr.1);
arr .concat: arr;

obj var: {a 1 b 2 c 3}
obj.a +: (obj.b);
obj.('a') +: (ob.('b'))
```
