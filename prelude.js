// Useful functions
function merge(a, b) {for(var k in a) b[k] = a[k]};
function composer() {
	var args = fixargs(arguments);
	return function() {
		var x = args[args.length-1].apply(null, fixargs(arguments));
		for(var i=args.length-2;i>=0;i--)
			x = args[i](x);
		return x;
	}
};
function compose() {
	var args = fixargs(arguments);
	return function() {
		var x = args[0].apply(null, fixargs(arguments));
		for(var i=1,l=args.length;i<l;i++)
			x = args[i](x);
		return x;
	}
};
function uniq(arr) {
	arr = arr.sort(function (a, b) { return a*1 - b*1; });
	var ret = [arr[0]];
	for (var i = 1; i < arr.length; i++) {
		if (arr[i-1] !== arr[i])
			ret.push(arr[i]);
	}
	return ret;
};

function iota(n) {for(var i=1,r=[];i<=n;i++) r.push(i); return r};
function range(a, b) {for(var i=a,r=[];i<b;i++) r.push(i); return r};
function iotas(n) {for(var i=0,r=[];i<n;i++) r.push(i); return r};

function cart() {
	var r = [], arg = fixargs(arguments).map(wrapp), max = arg.length-1;
	function helper(arr, i) {
		for (var j=0, l=arg[i].length; j<l; j++) {
			var a = arr.slice(0);
			a.push(arg[i][j])
			if (i==max) {
				r.push(a);
			} else
				helper(a, i+1);
		}
	}
	helper([], 0);
	return r;
};

function wrapp(x) {return Array.isArray(x)?x:[x]};
function wrap(x) {return [x]};

function slice(n, a) {
	if(typeof n != 'number') {
		var temp = n;
		n = a;
		a = temp;
	}
	return a.slice(n);
};
function take(n, a) {
	if(typeof n != 'number') {
		var temp = n;
		n = a;
		a = temp;
	}
	return a.slice(0, n)
};

function fpow(f, n) {
	if(arguments.length == 1) return fpow.bind(null, f);
	if(typeof n != 'number') {
		var temp = n;
		n = f;
		f = temp;
	}
	if(n == -1) {
		return function(v) {
			var prev;
			while(prev != v) {
				prev = v;
				v = f(v)
			}
			return v;
		};
	} else if(n < -1) {
		return function(v) {
			var am = -n;
			var prev = [];
			var gen = [v];
			var arrayeq = function(a, b) {
				if(a === b) return true;
				if(a.length !== b.length) return false;
				if(a.length === 0) return true;
				for(var i=0,l=a.length;i<l;i++)
					if(a[i] != b[i]) return false;
				return true;
			};
			var arraysearch = function(a, b) {
				for(var i=0,l=a.length;i<l;i++)
					if(arrayeq(a[i], b)) return true;
				return false;
			};
			while(!arraysearch(prev, gen)) {
				prev.push([].concat(gen));
				if(gen.length == am) gen.shift();
				gen.push(f(gen[gen.length-1]));
			}
			return gen;
		};
	} else return function(v) {
		for(var i=0;i<n;i++) v = f(v);
		return v;
	}
};

function fpowr(f, n) {
	if(arguments.length == 1) return fpow.bind(null, f);
	if(typeof n != 'number') {
		var temp = n;
		n = f;
		f = temp;
	}
	if(n == -1) {
		return function(v) {
			var r = [v];
			var prev;
			while(prev != v) {
				prev = v;
				v = f(v);
				r.push(v);
			}
			return r;
		};
	} else if(n < -1) {
		return function(v) {
			var am = -n;
			var prev = [];
			var gen = [v];
			var r = [v];
			var arrayeq = function(a, b) {
				if(a === b) return true;
				if(a.length !== b.length) return false;
				if(a.length === 0) return true;
				for(var i=0,l=a.length;i<l;i++)
					if(a[i] != b[i]) return false;
				return true;
			};
			var arraysearch = function(a, b) {
				for(var i=0,l=a.length;i<l;i++)
					if(arrayeq(a[i], b)) return true;
				return false;
			};
			while(!arraysearch(prev, gen)) {
				prev.push([].concat(gen));
				if(gen.length == am) gen.shift();
				gen.push(f(gen[gen.length-1]));
				r.push(gen[gen.length-1]);
			}
			return r;
		};
	} else return function(v) {
		var r = [v];
		for(var i=0;i<n;i++) {v = f(v); r.push(v)};
		return r;
	}
};

function first(a) {return a[0]};
function second(a) {return a[1]};
function last(a) {return a[a.length-1]};
function penult(a) {return a[a.length-2]};

function tail(a) {return a.slice(1)};
function init(a) {return a.slice(0, -1)};

function concat(a) {return a.concat.apply(a, fixargs(arguments, 1))};
function adda(a) {return a.concat.apply(a, wrap(fixargs(arguments, 1)))};

function size(x) {
	var t = typeof x;
	if(t == 'number') return (''+x).length;
	else if(t == 'string' || Array.isArray(x) || t == 'function') return x.length;
	else if(t == 'object') return Object.keys(x).length;
	return -1;
};

function reverse(l) {return [].concat(l).reverse()};

function revargs(f) {
	return function() {
		var args = fixargs(arguments).reverse();
		return f.apply(null, args);
	};
};

function constant(v) {return function() {return v}};
function id(x) {return x};
function ida() {return fixargs(arguments)};

function reflex(f) {
	return function(x) {
		var a = f.length <= 1? [x, x]: iota(f.length).map(constant(x)); 
		return f.apply(null, a);
	}
};

function filter(f, a) {
	if(arguments.length === 1) return filter.bind(null, f);
	if(typeof f != 'function') {
		var temp = f;
		f = a;
		a = temp;
	}
	for(var i=0,l=a.length,r=[];i<l;i++)
		if(f(a[i]))
			r.push(a[i]);
	return r;
};
function map(f) {
	if(arguments.length === 1) return map.bind(null, f);
	var args, l, ml;
	if(typeof f == 'function') {
		args = fixargs(arguments, 1).map(wrapp);
		ml = args.map(size).reduce(function(a,b){return Math.max(a,b)});
	} else {
		args = fixargs(arguments);
		args.splice(1, 1);
		args = args.map(wrapp);
		f = arguments[1];
	}
	l = arguments.length-1;
	ml = args.map(size).reduce(function(a,b){return Math.max(a,b)});
	for(var i=0,a=[];i<ml;i++) {
		for(var j=0,b=[];j<l;j++)
			b.push(getr(args[j], i));
		a.push(f.apply(null, b));
	}
	return a;
};
function mapcf(a) {return curry(mapc, a)};

function reduce(f, l) {
	if(arguments.length === 1) return reduce.bind(null, f);
	
	if(typeof f != 'function') {
		var temp = f;
		f = l;
		l = temp;
	}

	if(l.length === 0) return null;
	if(l.length === 1) return l[0];

	var v = l[0];
	for(var i=1,lng=l.length;i<lng;i++) {
		v = f(v, l[i]);
	}
	return v;

	// return l.reduce(f);
};

function curry(f) {
	return f.bind.apply(f, [null].concat(fixargs(arguments, 1)));
};
function curryr(f, v) {
	return function() {
		var args = fixargs(arguments);
		return f.apply(null, [args[0], v].concat(args.slice(1)));
	};
};

function fixargs(a,n,m) {return Array.prototype.slice.call(a,n,m)};

function inc(n) {return n+1};
function dec(n) {return n-1};

function max() {return fixargs(arguments).reduce(function(a,b){return Math.max(a,b)})};
function min() {return fixargs(arguments).reduce(function(a,b){return Math.min(a,b)})};

function add() {return fixargs(arguments).reduce(function(a,b){return a+b})};
function pow() {return fixargs(arguments).reduce(function(a,b){return Math.pow(a,b)})};
function sub() {return fixargs(arguments).reduce(function(a,b){return a-b})};
function mul() {return fixargs(arguments).reduce(function(a,b){return a*b})};
function div() {return fixargs(arguments).reduce(function(a,b){return a/b})};
function rem() {return fixargs(arguments).reduce(function(a,b){return a%b})};
function mod() {return fixargs(arguments).reduce(function(a,b){return ((a%b)+b)%b})};

function not(x) {return !x};
function or() {return fixargs(arguments).reduce(function(a,b){return a || b})};
function and() {return fixargs(arguments).reduce(function(a,b){return a && b})};
function nand() {return fixargs(arguments).reduce(function(a,b){return !(a && b)})};
function nor() {return fixargs(arguments).reduce(function(a,b){return !(a || b)})};

function eq() {return fixargs(arguments).reduce(function(a,b){return (a === b)})};
function neq() {return fixargs(arguments).reduce(function(a,b){return (a !== b)})};
function gr() {return fixargs(arguments).reduce(function(a,b){return (a > b)})};
function greq() {return fixargs(arguments).reduce(function(a,b){return (a >= b)})};
function ls() {return fixargs(arguments).reduce(function(a,b){return (a < b)})};
function lseq() {return fixargs(arguments).reduce(function(a,b){return (a <= b)})};

function even(n) {return !(n%2)};
function odd(n) {return n%2};
function pos(n) {return n>0};
function neg(n) {return n<0};
function isZero(n) {return n === 0};

function num(x) {return +x};
function str(x) {return ''+x};
function arr(x) {
	if(!Array.isArray(x)) {
		if(typeof x == 'object') {
			var r = [];
			for(var k in x) {
				if(x.hasOwnProperty(k)) {
					r.push([k, x[k]]);
				}
			}
			return r;
		} else return [x];
	} else return x;
};
function obj(x) {
	if(Array.isArray(x)) {
		var o_r = {};
		if(Array.isArray(x[0])) {
			for(var i=0,l=x.length;i<l;i++) {
				o_r[x[i][0]] = x[i][1];
			}
		} else {
			for(var i=0,l=x.length;i<l;i+=2) {
				var k = x[i], v = x[i+1];
				o_r[k] = v;
			}
		}
		return o_r;
	} else return x;
};

function memoize(func) {
	var memo = {};
	var slice = Array.prototype.slice;
	return function() {
		var args = slice.call(arguments);
		if (args in memo)
			return memo[args];
		else
			return (memo[args] = func.apply(this, args));
	}
};

function iff(c, a, b) {
	return function() {
		var args = fixargs(arguments);
		return apply(c, args)? apply(a, args): apply(b, args);
	};
};

function zip() {
	var args = fixargs(arguments).map(wrapp),
			l = args.length,
			ml = args.map(size).reduce(function(a,b){return Math.max(a,b)});
	for(var i=0,a=[];i<ml;i++) {
		for(var j=0,b=[];j<l;j++)
			b.push(getr(args[j], i));
		a.push(b);
	}
	return a;
};

function get(a, i) {
	return a[i];
};
function getr(a, i) {
	var l = a.length;
	return a[((i%l)+l)%l];
};

function call(f) {
	return f.apply(null, fixargs(arguments, 1));
};
function apply(f, a) {
	if(arguments.length === 1) return curry(apply, f);
	return f.apply(null, a);
};

var mapc = map(call);
var sum = apply(add);
var flatten = reduce(concat);
var prd = apply(mul);

function split(d, s) {
	if(arguments.length === 1) return split.bind(null, d);
	return s.split(d);
};
function join(d, a) {
	if(arguments.length === 1) return join.bind(null, d);
	return a.join(d);
};
function test(re, s) {
	if(arguments.length === 1) return test.bind(null, re);
	return re.test(s);
};

if(module && module.exports) module.exports = {
	composer: composer,
	compose: compose,
	uniq: uniq,
	iota: iota,
	iotas: iotas,
	cart: cart,
	wrapp: wrapp,
	wrap: wrap,
	slice: slice,
	take: take,
	first: first,
	second: second,
	last: last,
	penult: penult,
	tail: tail,
	init: init,
	flatten: flatten,
	concat: concat,
	adda: adda,
	size: size,
	revargs: revargs,
	reverse: reverse,
	constant: constant,
	id: id,
	ida: ida,
	reflex: reflex,
	filter: filter,
	map: map,
	mapcf: mapcf,
	reduce: reduce,
	curry: curry,
	curryr: curryr,
	fixargs: fixargs,
	inc: inc,
	dec: dec,
	max: max,
	min: min,
	add: add,
	sub: sub,
	mul: mul,
	div: div,
	rem: rem,
	mod: mod,
	not: not,
	or: or,
	and: and,
	nand: nand,
	nor: nor,
	eq: eq,
	neq: neq,
	gr: gr,
	greq: greq,
	ls: ls,
	lseq: lseq,
	even: even,
	odd: odd,
	pos: pos,
	neg: neg,
	pow: pow,
	isZero: isZero,
	fpow: fpow,
	fpowr: fpowr,
	num: num,
	str: str,
	arr: arr,
	obj: obj,
	memoize: memoize,
	iff: iff,
	zip: zip,
	get: get,
	getr: getr,
	call: call,
	apply: apply,
	mapc: mapc,
	sum: sum,
	prd: prd,
	split: split,
	join: join,
	test: test,
	range: range,
	merge: merge
};
