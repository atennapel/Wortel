/*
	Wortel
	@author: Albert ten Napel
	@version: 0.1 
*/

var Wortel = (function() {
	// Parser
	var symbols = '~`!@#%^&*-+=|\\:;?/><,';
	function isSymbol(c) {return symbols.indexOf(c) != -1};
	var brackets = '()[]{}';
	function isBracket(c) {return brackets.indexOf(c) != -1};
	function otherBracket(c) {var n = brackets.indexOf(c); return n == -1? false: brackets[n+(n%2?-1:1)]};
	function isValidName(c) {return /[0-9a-z\_\$\.]/i.test(c)};

	function parse(s) {
		var START = 0, NUMBER = 1, SYMBOL = 2, NAME = 3, STRING = 4, WHITESPACE = 5,
				r = [], t = [], strtype = esc = false;
		s += ' ';
		for(var i = 0, l = s.length, state = START, c; c = s[i], i < l; i++) {
			if(state == START) {
				if(isBracket(c)) r.push({type: c});
				else if(c == "'" || c == '"') strtype = c, state = STRING;
				else if(/[0-9]/.test(c)) t.push(c), state = NUMBER;
				else if(isSymbol(c)) t.push(c), state = SYMBOL;
				else if(isValidName(c)) t.push(c), state = NAME;
				else if(/\s/.test(c)) t.push(c), state = WHITESPACE;
			} else if(state == NUMBER) {
				if(/[^0-9a-z\.]/i.test(c))
					r.push({type: 'number', val: t.join('')}), t = [], i--, state = START;
				else t.push(c);
			} else if(state == SYMBOL) {
				if(!isSymbol(c))
					r.push.apply(r, splitSymbol(t.join(''))), t = [], i--, state = START;
				else t.push(c);
			} else if(state == NAME) {
				if(!isValidName(c))
					r.push({type: 'name', val: t.join('')}), t = [], i--, state = START;
				else t.push(c);
			} else if(state == STRING) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') t.push(c), esc = true;
				else if(c != strtype) t.push(c);
				else r.push({type: 'string', strtype: strtype, val: t.join('')}), t = [], state = START;
			} else if(state == WHITESPACE) {
				if(/\s/.test(c)) t.push(c);
				else r.push({type: 'whitespace', val: t.join('')}), t = [], i--, state = START;
			}
		}

		// Handle special operators
		for(var i = 0, c; c = r[i], i < r.length; i++)
			if(c.type == 'symbol' && c.val == '@' && r[i+1] && r[i+1].type == 'name') {
				var v = '@'+r[i+1].val;
				if(!(v in operators)) throw 'Unknown operator: ' + v;
				r.splice(i, 2, {type: 'symbol', val: v});
			}

		// Remove whitespace
		r = r.filter(function(x) {return x.type != 'whitespace'});	

		return toAST(groupBrackets(r));
	};

	function splitSymbol(s) {
		for(var i = 0, r = [], t = '', l = s.length; i < l; i++) {
			t += s[i];
			if(t.length > 0 && !maybeOperator(t)) {
				if(t.length == 1) throw 'Unknown operator: ' + t;
				r.push(t.slice(0, -1)), t = '', i--;
			}
		}
		if(t.length > 0) {
			if(!(t in operators)) throw 'Unknown operator: ' + t;
			r.push(t);
		}
		return r.map(function(s) {return {type: 'symbol', val: s}});
	};

	function maybeOperator(n) {
		for(var k in operators)
			if(k.length >= n.length && k.substr(0, n.length) === n)
				return true;
		return false;
	};

	function groupBrackets(r) {
		for(var i = 0, level = 0, ind, c, cb; c = r[i], i < r.length; i++)
			if(cb) {
				if(c.type == cb) level++;
				else if(c.type == otherBracket(cb) && --level == 0)
					r.splice(ind, i-ind+1, {type: cb, val: groupBrackets(r.slice(ind+1, i))}),
					cb = false, i = ind;
			} else if('([{'.indexOf(c.type) != -1)
				cb = c.type, ind = i, level++;
		return r;
	};

	function toAST(p) {
		for(var i = 0, l = p.length, r = [], c, ret; c = p[i], i < l; i++)
			if(c.type == 'symbol')
				ret = getArgs(c.val, p, i+1), i = ret.i, r.push(convertToken(ret.val));
			else if('([{'.indexOf(c.type) != -1)
				r.push(convertToken({type: c.type, val: toAST(c.val)}));
			else r.push(convertToken(c));
		return r;
	};

	function getArgs(symbol, p, i) {
		for(var n = 0, arity = operators[symbol].length, args = [], c; c = p[i], n < arity; i++, n++) {
			if(c === undefined) throw 'Could not find arguments for ' + symbol;
			if(c.type == 'symbol')
				ret = getArgs(c.val, p, i+1), i = ret.i, args.push(convertToken(ret.val));
			else if('([{'.indexOf(c.type) != -1)
				args.push(convertToken({type: c.type, val: toAST(c.val)}));
			else args.push(convertToken(p[i]));
		}
		return {i: i-1, val: {type: 'block', val: symbol, args: args}};
	};

	function convertToken(x) {
		if(x.type == '[') return new Expr.Array(x.val);
		if(x.type == '(') return new Expr.Group(x.val);
		if(x.type == '{') return new Expr.Object(x.val);
		if(x.type == 'number') return new Expr.Number(x.val);
		if(x.type == 'string') return new Expr.String(x.val, x.strtype);
		if(x.type == 'block') return new Expr.Block(x.val, x.args);
		throw 'Unknown token type: ' + c.type;
	};

	// Compilation
	function toJS(ast) {
		return ast;
	};

	function compile(s) {return toJS(parse(s))};

	// Expr
	function toString(x) {return x.toString()};
	var Expr = {};
	// Number
	Expr.Number = function(n) {
		this.val = n;
	};
	Expr.Number.prototype.toString = function() {return ''+this.val};
	// String
	Expr.String = function(s, strtype) {
		this.val = s;
		this.strtype = strtype;
	};
	Expr.String.prototype.toString = function() {return '"'+this.val+'"'};
	// Block
	Expr.Block = function(o, args) {
		this.val = o;
		this.args = args;
	};
	Expr.Block.prototype.toString = function() {
		return '('+this.val+' '+this.args.map(toString).join(' ')+')';
	};
	// Array
	Expr.Array = function(a) {
		this.val = a;
	};
	Expr.Array.prototype.toString = function() {
		return '['+this.val.map(toString).join(' ')+']';
	};
	// Group
	Expr.Group = function(a) {
		this.val = a;
	};
	Expr.Group.prototype.toString = function() {
		return '('+this.val.map(toString).join(' ')+')';
	};
	// Object
	Expr.Object = function(a) {
		this.val = a;
	};
	Expr.Object.prototype.toString = function() {
		return '{'+this.val.map(toString).join(' ')+'}';
	};

	// JS
	var JS = {};
	JS.BinOp = function(op, a, b) {
		this.op = op;
		this.a = a;
		this.b = b;
	};

	// Operators
	var operators = {
		'+': function(x, y) {return new JS.BinOp('+', x, y)},
		'-': function(x, y) {return new JS.BinOp('-', x, y)},
		'*': function(x, y) {return new JS.BinOp('*', x, y)},
		'/': function(x, y) {return new JS.BinOp('/', x, y)},
		'%': function(x, y) {return new JS.BinOp('%', x, y)}
	};

	return {
		compile: compile
	};
})();

console.log(Wortel.compile('+ 1 + 2 3')[0].toString());
