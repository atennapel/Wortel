(function() {
	// suffixes
	var suffixes = {
		'K': function(n) {
			return n*1000;
		},
		'P': function(n) {
			return n*Math.PI;
		},
		'E': function(n) {
			return n*Math.E;
		},
	};

	function doSuffix(s, n) {
		if(!suffixes[s])
			throw 'Unknown number suffix: '+s;
		return suffixes[s](n)
	};

	function doSuffixes(a, n) {
		var c = n;
		a.forEach(function(s) {c = doSuffix(s, c)});
		return c;
	};

	function compileSimpleNumber(n) {
		return doSuffixes(n.suffix, n.val);
	};

	// modifiers
	var modifiers = {
		'e': function(x, y) {
			return x*Math.pow(10, y);
		},
		'p': function(x, y) {
			return Math.pow(x, y);
		},
	};

	var doModifier = function(n, mod) {
		if(!modifiers[mod.mod])
			throw 'Unknown number modifier: '+mod.mod;
		return modifiers[mod.mod](n, compileSimpleNumber(mod.number));
	};

	var doModifiers = function(n, a) {
		var c = n;
		a.forEach(function(m) {c = doModifier(c, m)});
		return c;
	};

	var createLiteral = function(x) {
		if(typeof x == 'number' && x < 0) return {
			type: 'UnaryExpression',
			operator: '-',
			prefix: true,
			argument: createLiteral(-x)
		}; else return {
			type: 'Literal',
			value: x
		};
	};

	function compile(n) {
		if(n.type != 'number') throw 'Not a number: '+n;
		var r = typeof n.val == 'number'? n.val: doModifiers(compileSimpleNumber(n.val), n.mods);
		return createLiteral(r);
	};

	module.exports = compile;
})();
