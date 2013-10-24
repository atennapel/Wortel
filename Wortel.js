/*
	Wortel
	@author: Albert ten Napel
	@version: 0.3

	TODO:
		add operators
		regexp literals
		what do parentheses do?
		improve names
		improve numbers
		improve string interpolation
*/

var Wortel = (function() {
	var _randN = 0;
	function randVar() {return new JS.Name('_var'+(_randN++))}
		
	// Parser
	var symbols = '~`!@#%^&*-+=|\\:;?/><,';
	var quoteSymbols = '\\@';
	function isSymbol(c) {return symbols.indexOf(c) != -1};
	var brackets = '()[]{}';
	function isBracket(c) {return brackets.indexOf(c) != -1};
	function otherBracket(c) {var n = brackets.indexOf(c); return n == -1? false: brackets[n+(n%2?-1:1)]};
	function isValidName(c) {return /[0-9a-z\_\$\.]/i.test(c)};

	function parse(s) {
		var START = 0, NUMBER = 1, SYMBOL = 2, NAME = 3, STRING = 4,
				r = [], t = [], strtype = esc = whitespace = false;
		s += ' ';
		for(var i = 0, l = s.length, state = START, c; c = s[i], i < l; i++) {
			if(state == START) {
				if(isBracket(c)) r.push({type: c});
				else if(c == "'" || c == '"') strtype = c, state = STRING;
				else if(/[0-9]/.test(c)) t.push(c), state = NUMBER;
				else if(isSymbol(c)) t.push(c), state = SYMBOL;
				else if(isValidName(c)) t.push(c), whitespace = /\s/.test(s[i-1] || ''), state = NAME;
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
					r.push({type: 'name', val: t.join(''), whitespace: whitespace}), whitespace = false, t = [], i--, state = START;
				else t.push(c);
			} else if(state == STRING) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') t.push(c), esc = true;
				else if(c != strtype) t.push(c);
				else r.push({type: 'string', strtype: strtype, val: t.join('')}), t = [], state = START;
			}
		}

		// Handle special operators
		for(var i = 0, c; c = r[i], i < r.length; i++)
			if(c.type == 'symbol' && c.val == '@' && r[i+1] && r[i+1].type == 'name' && !r[i+1].whitespace) {
				var v = '@'+r[i+1].val;
				if(!(v in operators)) throw 'Unknown operator: ' + v;
				r.splice(i, 2, {type: 'symbol', val: v});
			}
		for(var i = 0, c; c = r[i], i < r.length; i++)
			if(c.type == 'symbol' && c.val == '~' && r[i+1].type == 'symbol') {
				r[i+1].reversed = true;
				r.splice(i, 2, r[i+1]);
			}
		for(var i = 0, c; c = r[i], i < r.length; i++)
			if(c.type == 'symbol' && quoteSymbols.indexOf(c.val) != -1 && r[i+1].type == 'symbol')
				r[i+1].quoted = true;

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
			if(c.type == 'symbol') {
				if(c.quoted) r.push(convertToken({
					type: 'block',
					val: c.val,
					args: [],
					quoted: true,
					reversed: c.reversed
				})); else {
					var n = operators[c.val].length,
							args = n? r.splice(-n): [];
					if(!c.reversed) args.reverse();
					r.push(convertToken({
						type: 'block',
						val: c.val,
						args: args,
						reversed: c.reversed
					}));
				}
			} else if('([{'.indexOf(c.type) != -1)
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
		if(x.type == 'block') return new JS.Block(x.val, x.args, x.quoted, x.reversed);
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
	JS.Number = function(n) {this.val = (''+n) || '0'};
	JS.Number.prototype.toString = function() {return ''+this.val};
	JS.Number.prototype.compile = function() {
		if(/^(0x[0-9af]+|0[0-7]+)$/i.test(this.val)) return ''+this.val;
		if(/^[0-9]+x/.test(this.val)) {
			var f = this.val.match(/^[0-9]+x/)[0];
			return ''+parseInt(this.val.slice(f.length), f.slice(0, -1));
		}
		var fn, val;
		if(this.val[this.val.length-1] == 'F') {
			fn = true;
			val = this.val.slice(0, -1);
		} else fn = false, val = this.val;
		var seps = val.match(/[a-z]+/g);
		var t = val.match(/[0-9\.]+[A-Z]*/g).map(function(x) {
			var n = 0;
			var s = x.match(/[0-9]+|[0-9]+\.[0-9]+|[A-Z]/g);
			while(s.length > 0) {
				var c = s.shift(), na = +c;
				if(!isNaN(na)) n = na;
				else if(c == 'T') n *= 10;
				else if(c == 'H') n *= 100;
				else if(c == 'K') n *= 1e3;
				else if(c == 'M') n *= 1e6;
				else if(c == 'B') n *= 1e9;
				else if(c == 'P') n *= Math.PI;
				else if(c == 'V') n = Math.sqrt(n);
				else if(c == 'N') n *= -1;
				else throw 'Unknown number modifier: '+c;
			}
			return n;
		}).reduce(function(a, b, i) {
			var sep = seps[i-1];
			if(sep == 'p') return Math.pow(a, b);
			if(sep == 'rp') return Math.pow(b, a);
			if(sep == 'e') return a*Math.pow(10, b);
			if(sep == 're') return b*Math.pow(10, a);
			if(sep == 'd') return a/b;
			if(sep == 'rd') return b/a;
			if(sep == 'a') return a+b;
			if(sep == 'm') return a*b;
			if(sep == 's') return a-b;
			if(sep == 'rs') return b-a;
		});
		return fn? '(function(){return '+t+'})': ''+t;
	};
	// Name
	JS.Name = function(n) {
		this.val = n || 'undefined';
	};
	JS.Name.prototype.toString = function() {return ''+this.val};
	JS.Name.prototype.compile = function() {
		if(this.val === '.') return 'undefined';
		if(this.val === '..') return 'function(x){return x}';
		var t = this.val.replace(/(\.[0-9]+\.)|(\.[0-9]+$)/g,
			function(a) {
				return a[a.length-1]==='.'?
					'['+a.substring(1, a.length-1)+'].':
					'['+a.substring(1)+']'
			}
		).replace(/\.\./g, '().').replace('.[', '()[');
		if(t[t.length-1] === '.') t = t.substring(0, t.length-1)+'()';
		if(t[0] === '.' || t[0] === '[') return 'function(x){return x'+t+'}';
		return ''+t;
	};
	// String
	JS.String = function(s, strtype) {
		this.val = s.replace(/\n/g, '\\n') || '';
		this.type = strtype || "'";
	};
	JS.String.prototype.toString = function() {return this.type+this.val+this.type};
	JS.String.prototype.compile = function() {
		if(this.type === '"' && /([^\\]|^)\{/g.test(this.val)) {
			var START = 0, EXPR = 1;
			var state = START, level = 0, re = [], te = [];
			for(var i=0,l=this.val.length;i<l;i++) {
				var c = this.val[i], pc = this.val[i-1];
				if(state === START) {
					if(c === '{' && pc !== '\\') te.push({type: 'str', val: re.join('')}), re = [], state = EXPR, level = 1;
					else re.push(c);
				} else if(state === EXPR) {
					if(c === '{') re.push(c), level++;
					else if(c === '}') {
						level--;
						if(level === 0) {
							te.push({type: 'expr', val: re.join('')}), re = [], state = START;
						} else re.push(c);
					} else re.push(c);
				}	
			}
			if(re.length > 0) te.push({type: 'str', val: re.join('')});
			if(te[0].type !== 'str') te = [{type:'str',val:''}].concat(te);
			return te.map((function(x) {return x.type === 'str'? this.type+x.val+this.type:'('+compile(x.val)+')'}).bind(this)).join(' + ');
		} else return this.type+this.val+this.type;
	};
	// Block
	JS.Block = function(o, args, q, r) {
		this.val = o;
		this.args = args;
		this.quoted = q || false;
		this.reversed = r || false;
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
		'\\': function(bl, arg) {
			if(bl instanceof JS.Block && !(arg instanceof JS.Array)) {
				for(var i = 0, n = operators[bl.val].length-1, args = []; i < n; i++) args.push(randVar());
				return new JS.ExprFn('', args, operators[bl.val].apply(null, bl.reversed? args.concat([arg]): [arg].concat(args)));
			} else return new JS.FnCall('Function.prototype.bind.call', [bl, new JS.Name('this'), arg]);
		},
		// ternary
		'@!': function(fn, x, y) {return new JS.FnCall(fn, [x, y])},
	
		// Wortel
		'~': function() {return new JS.Empty()},
		'@': function() {return new JS.Empty()},
		// unary
		'@comment': function(s) {return new JS.Empty()},
		'^': function(bl) {
			if(bl instanceof JS.Block) {
				for(var i = 0, n = operators[bl.val].length, args = []; i < n; i++) args.push(randVar());
				return new JS.ExprFn('', args, operators[bl.val].apply(null, args));
			} else if(bl instanceof JS.Name) return new JS.Name('this.'+bl.val);
			return new JS.Empty();
		},
	};

	return {
		compile: compile,
		parse: parse
	};
})();
