/*
	Wortel
	@author: Albert ten Napel
	@version: 0.1

	TODO:
		add operators
		add \ (partial application) and ~ (reverse arguments) and ~\ or \~
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
		for(var i = p.length-1, r = [], c; c = p[i], i >= 0; i--)
			if(c.type == 'symbol')
				r.push(convertToken({
					type: 'block',
					val: c.val,
					args: r.splice(-operators[c.val].length).reverse()
				}));
			else if('([{'.indexOf(c.type) != -1)
				r.push(convertToken({type: c.type, val: toAST(c.val)}));
			else r.push(convertToken(c));
		return r.reverse();
	};

	function convertToken(x) {
		if(x.type == '[') return new JS.Array(x.val);
		if(x.type == '(') return new JS.Group(x.val);
		if(x.type == '{') return new JS.Object(x.val);
		if(x.type == 'number') return new JS.Number(x.val);
		if(x.type == 'name') return new JS.Name(x.val);
		if(x.type == 'string') return new JS.String(x.val, x.strtype);
		if(x.type == 'block') return new JS.Block(x.val, x.args);
		throw 'Unknown token type: ' + x.type;
	};

	// Compilation
	function toJS(ast) {
		return ast.map(mCompile).filter(function(x) {return x}).join(';');
	};

	function compile(s) {return toJS(parse(s))};

	// Expr
	function toString(x) {return x.toString()};
	function mCompile(x) {return x.compile()};
	var JS = {};
	// Number
	JS.Number = function(n) {
		this.val = n;
	};
	JS.Number.prototype.toString = function() {return ''+this.val};
	JS.Number.prototype.compile = function() {return ''+this.val};
	// Name
	JS.Name = function(n) {
		this.val = n;
	};
	JS.Name.prototype.toString = function() {return ''+this.val};
	JS.Name.prototype.compile = function() {return ''+this.val};
	// String
	JS.String = function(s, strtype) {
		this.val = s;
		this.strtype = strtype;
	};
	JS.String.prototype.toString = function() {return this.strtype+this.val+this.strtype};
	JS.String.prototype.compile = function() {return this.strtype+this.val+this.strtype};
	// Block
	JS.Block = function(o, args) {
		this.val = o;
		this.args = args;
	};
	JS.Block.prototype.toString = function() {
		return '('+this.val+' '+this.args.map(toString).join(' ')+')';
	};
	JS.Block.prototype.compile = function() {
		return operators[this.val].apply(null, this.args).compile();
	};
	// Array
	JS.Array = function(a) {
		this.val = a;
	};
	JS.Array.prototype.toString = function() {
		return '['+this.val.map(toString).join(' ')+']';
	};
	JS.Array.prototype.compile = function() {
		return '['+this.val.map(mCompile).join(',')+']';
	};
	// Group
	JS.Group = function(a) {
		this.val = a;
	};
	JS.Group.prototype.toString = function() {
		return '('+this.val.map(toString).join(' ')+')';
	};
	JS.Group.prototype.compile = function() {
		return '('+this.val.map(mCompile).join(',')+')';
	};
	// Object
	JS.Object = function(a) {
		this.val = a;
	};
	JS.Object.prototype.toString = function() {
		return '{'+this.val.map(toString).join(' ')+'}';
	};
	JS.Object.prototype.compile = function() {
		for(var i = 0, t = this.val.map(mCompile), l = t.length, r = []; i < l; i += 2)
			r.push(t[i]+':'+t[i+1]);
		return '{'+r.join(',')+'}';
	};
	// JS expressions
	// Empty
	JS.Empty = function() {};
	JS.Empty.prototype.compile = function() {return ''};
	// BinOp
	JS.BinOp = function(op, a, b) {
		this.op = op;
		this.a = a;
		this.b = b;
	};
	JS.BinOp.prototype.compile = function() {
		return '('+this.a.compile()+this.op+this.b.compile()+')';
	};
	// UnOp
	JS.UnOp = function(op, a) {
		this.op = op;
		this.a = a;
	};
	JS.UnOp.prototype.compile = function() {
		return '('+this.op+this.a.compile()+')';
	};
	// FnCall
	JS.FnCall = function(fn, args) {
		this.fn = fn;
		this.args = args;
	};
	JS.FnCall.prototype.compile = function() {
		return (typeof this.fn == 'string'? this.fn: '('+this.fn.compile()+')')+'('+this.args.map(mCompile).join(',')+')';
	};
	// ExprFn
	JS.ExprFn = function(name, args, body) {
		this.name = name;
		this.args = args;
		this.body = body;
	};
	JS.ExprFn.prototype.compile = function() {
		return '(function '+(!this.name? '': typeof this.name == 'string'? this.name: this.name.compile())+
			'('+this.args.map(mCompile).join(',')+'){return '+this.body.compile()+'})';
	};

	function wrap(a) {return a instanceof JS.Array? a.val: [a]};
	// Operators
	var operators = {
		// Math
		// unary
		'@+': function(x) {return new JS.UnOp('+', x)},
		'@-': function(x) {return new JS.UnOp('-', x)},
		// binary
		'+': function(x, y) {return new JS.BinOp('+', x, y)},
		'-': function(x, y) {return new JS.BinOp('-', x, y)},
		'*': function(x, y) {return new JS.BinOp('*', x, y)},
		'/': function(x, y) {return new JS.BinOp('/', x, y)},
		'%': function(x, y) {return new JS.BinOp('%', x, y)},
		'^': function(x, y) {return new JS.FnCall('Math.pow', [x, y])},

		// Boolean
		// unary
		'@not': function(x) {return new JS.UnOp('!', x)},
		// binary
		'=': function(x, y) {return new JS.BinOp('==', x, y)},
		'!=': function(x, y) {return new JS.BinOp('!=', x, y)},
		'==': function(x, y) {return new JS.BinOp('===', x, y)},
		'!==': function(x, y) {return new JS.BinOp('!==', x, y)},
		'>': function(x, y) {return new JS.BinOp('>', x, y)},
		'>=': function(x, y) {return new JS.BinOp('>=', x, y)},
		'<': function(x, y) {return new JS.BinOp('<', x, y)},
		'<=': function(x, y) {return new JS.BinOp('<=', x, y)},

		'||': function(x, y) {return new JS.BinOp('||', x, y)},
		'&&': function(x, y) {return new JS.BinOp('&', x, y)},

		// Function
		// binary
		'&': function(args, body) {return new JS.ExprFn('', wrap(args), body)},
		'!': function(fn, args) {return new JS.FnCall(fn, wrap(args))},
		// ternary
		'@!': function(fn, x, y) {return new JS.FnCall(fn, [x, y])},
	
		// Wortel
		'@': function() {return new JS.Empty()},
		// unary
		'@comment': function(s) {return new JS.Empty()},
	};

	return {
		compile: compile
	};
})();

console.log(Wortel.compile('&a&b + a b @comment "as\ndas"'));
