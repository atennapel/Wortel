/*
	Wortel
	@author: Albert ten Napel
	@version: 0.5

	TODO:
		add operators
		improve names
		improve numbers
		improve string interpolation
*/

var Wortel = (function() {
	var version = 0.5;
	var _randN = 0;
	function randVar() {return new JS.Name('_'+(_randN++))}
		
	// Parser
	var symbols = '~`!@#%^&*-+=|\\:?/><,';
	var quoteSymbols = '\\^';
	function isSymbol(c) {return symbols.indexOf(c) != -1};
	var brackets = '()[]{}';
	function isBracket(c) {return brackets.indexOf(c) != -1};
	function otherBracket(c) {var n = brackets.indexOf(c); return n == -1? false: brackets[n+(n%2?-1:1)]};
	function isValidName(c) {return /[0-9a-z\_\$\.]/i.test(c)};

	function parse(s) {
		var START = 0, NUMBER = 1, SYMBOL = 2, NAME = 3, STRING = 4, COMMENT = 5,
				r = [], t = [], strtype = esc = whitespace = false;
		s += ' ';
		for(var i = 0, l = s.length, state = START, c; c = s[i], i < l; i++) {
			if(state == START) {
				if(isBracket(c)) r.push({type: c});
				else if(c == ';') state = COMMENT;
				else if(c == "'" || c == '"') strtype = c, state = STRING;
				else if(/[0-9]/.test(c)) t.push(c), state = NUMBER;
				else if(isSymbol(c)) t.push(c), state = SYMBOL;
				else if(isValidName(c)) t.push(c), whitespace = /\s/.test(s[i-1] || ''), state = NAME;
			} else if(state == NUMBER) {
				if(!isValidName(c))
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
			} else if(state == COMMENT) {
				if(c == '\n') state = START;
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
	function toJS(ast, sub) {
		var astc = ast.map(mCompile), lib = [];
		if(!sub) for(var k in curLibs) lib.push(Lib[k].compile());
		return lib.concat(astc).filter(function(x) {return x}).join(';');
	};

	function compile(s, sub) {return toJS(parse(s), sub)};

	// Expr
	function toString(x) {return x.toString()};
	function mCompile(x) {return x.compile()};
	var JS = {};
	// Number
	function compileNumber(str) {
		var str = str.replace(/\$|\_/g, '');
		if(/^(0x[0-9af]+|0[0-7]+)$/i.test(str)) return ''+str;
		if(/^[0-9]+x/.test(str)) {
			var f = str.match(/^[0-9]+x/)[0];
			return ''+parseInt(str.slice(f.length), f.slice(0, -1));
		}
		var fn, val;
		if(str[str.length-1] == 'F') {
			fn = true;
			val = str.slice(0, -1);
		} else fn = false, val = str;
		var seps = val.match(/[a-z]+/g);
		var t = val.match(/[0-9\.]+[A-Z]*|[A-Z]+/g).map(function(x) {
			if(/[a-z]/i.test(x[0])) return x;
			var n = 0;
			var s = x.match(/[0-9]+\.[0-9]+|[0-9]+|[A-Z]/g);
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
				else if(c == 'S') n *= n;
				else if(c == 'A') n /= 2;
				else if(c == 'E') n *= 2;
				else if(c == 'I') n += 1;
				else if(c == 'D') n -= 1;
				else if(c == 'R') n = Math.round(n);
				else if(c == 'C') n = Math.ceiling(n);
				else if(c == 'F') n = Math.floor(n);
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
			if(sep == 'c') return compileNumber(a + b);
		});
		return fn? '(function(){return '+t+'})': ''+t;
	};
	JS.Number = function(n) {this.val = (''+n) || '0'};
	JS.Number.prototype.toString = function() {return ''+this.val};
	JS.Number.prototype.compile = function() {return compileNumber(this.val)};
	// Name
	JS.Name = function(n) {
		this.val = n || 'undefined';
	};
	JS.Name.prototype.toString = function() {return ''+this.val};
	JS.Name.prototype.compile = function(nofn) {
		if(this.val === '.') return 'null';
		if(this.val === '..') return 'function(x){return x}';
		var t = this.val.replace(/(\.[0-9][0-9a-z]*\.)|(\.[0-9][0-9a-z]*$)/gi,
			function(a) {
				return a[a.length-1]==='.'?
					'['+compileNumber(a.substring(1, a.length-1))+'].':
					'['+compileNumber(a.substring(1))+']'
			}
		).replace(/\.\./g, '().').replace('.[', '()[');
		if(t[t.length-1] === '.') t = t.substring(0, t.length-1)+'()';
		if(!nofn && t[0] === '.' || t[0] === '[') return '(function(x){return x'+t+'})';
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
			return te.map((function(x) {return x.type === 'str'? this.type+x.val+this.type:'('+compile(x.val, true)+')'}).bind(this)).join(' + ');
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
		checkLib(this.val);
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
		return this.val.length == 0? 'undefined': '('+this.val.map(mCompile).join(',')+')';
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
	// MethodCall
	JS.MethodCall = function(o, mtd, args) {
		this.o = o;
		this.mtd = mtd;
		this.args = args;
	};
	JS.MethodCall.prototype.compile = function() {
		if(this.mtd instanceof JS.String)
			return '('+this.o.compile()+')['+this.mtd.compile()+']('+this.args.map(mCompile).join(',')+')';
		else
			return '('+this.o.compile()+').'+(typeof this.mtd == 'string'? this.mtd: this.mtd.compile())+'('+this.args.map(mCompile).join(',')+')';
	};
	// ExprFn
	JS.ExprFn = function(name, args, body, statement) {
		this.name = name || '';
		this.args = args || [];
		this.body = body;
		this.statement = statement || false;
	};
	JS.ExprFn.prototype.compile = function() {
		var s = 'function '+(!this.name? '': typeof this.name == 'string'? this.name: this.name.compile())+
				'('+this.args.map(mCompile).join(',')+'){return '+this.body.compile()+'}';
		return this.statement? s: '('+s+')';
	};
	// Fn
	JS.Fn = function(name, args, body, statement) {
		this.name = name || '';
		this.args = args || [];
		this.body = body;
		this.statement = statement || false;
	};
	JS.Fn.prototype.compile = function() {
		var s = 'function '+(!this.name? '': typeof this.name == 'string'? this.name: this.name.compile())+
				'('+this.args.map(mCompile).join(',')+'){'+this.body.map(mCompile).join(';')+'}';
		return this.statement? s: '('+s+')';
	};
	// Index
	JS.Index = function(a, i) {
		this.a = a;
		this.i = i;
	};
	JS.Index.prototype.compile = function() {
		return '('+this.a.compile()+')'+
			(this.i instanceof JS.Name && this.i.val[0] == '.'? this.i.compile(true): '['+this.i.compile()+']');
	};
	// Prefix
	JS.Prefix = function(p, x) {
		this.p = p;
		this.x = x;
	};
	JS.Prefix.prototype.compile = function() {return this.p+this.x.compile()};
	// RegExp
	JS.RegExp = function(r, m) {
		this.r = r;
		this.m = m;
	};
	JS.RegExp.prototype.compile = function() {
		var m = !this.m.val || (this.m instanceof JS.Name && this.m.val == '.')? '':
						this.m instanceof JS.Array || this.m instanceof JS.Group?
							this.m.val.map(mCompile).join(''): this.m.compile();
		return this.r instanceof JS.String? '/'+this.r.val+'/'+m: '(new RegExp('+this.r.compile()+',"'+m+'"))';
	};
	// Ternary
	JS.Ternary = function(a) {
		this.a = a;
	};
	JS.Ternary.prototype.compile = function() {
		var a = this.a, l = a.length;
		if(l == 0) return 'null';
		if(l == 1) return a[0].compile();
		if(l == 2) return '('+a[0].compile()+'?'+a[1].compile()+':null)';
		if(l == 3) return '('+a[0].compile()+'?'+a[1].compile()+':'+a[2].compile()+')';

		for(var i = 0, r = []; i < l; i += 2) {
			var cond = a[i], val = a[i+1];
			r.push(
				val === undefined?
					':' + cond.compile():
					(i > 0? ':': '') + cond.compile() + '?' + val.compile()
			);
		}
		if(l % 2 == 0) r.push(':null');
		return '('+r.join('')+')';
	};
	// If
	function compileArray(a) {
		return wrap(a).map(mCompile).join(';');
	};
	JS.If = function(a) {
		this.a = a;
	};
	JS.If.prototype.compile = function() {
		var a = this.a, l = a.length;
		if(l == 0) return 'null';
		if(l == 1) return a[0].compile();
		if(l == 2) return 'if('+a[0].compile()+'){'+compileArray(a[1])+'}';
		if(l == 3) return 'if('+a[0].compile()+'){'+compileArray(a[1])+'}else{'+compileArray(a[2])+'}';

		for(var i = 0, r = []; i < l; i += 2) {
			var cond = a[i], val = a[i+1];
			r.push(
				val === undefined?
					'else{' + compileArray(cond) + '}':
					(i > 0? 'else if(': 'if(') + cond.compile() + '){' + compileArray(val) + '}'
			);
		}
		return r.join('');
	};
	// While
	JS.While = function(c, a) {
		this.c = c;
		this.a = a;
	};
	JS.While.prototype.compile = function() {
		return 'while('+this.c.compile()+'){'+compileArray(this.a)+'}';
	};
	// Assigment
	JS.Assigment = function(o) {
		this.o = o;
	};
	JS.Assigment.prototype.compile = function() {
		for(var i = 0, a = this.o, l = a.length, r = []; i < l; i += 2) {
			var k = a[i], v = a[i+1];
			r.push(k.compile() + '=' + v.compile());
		}
		return r.join(',');
	};
	// CommaList
	JS.CommaList = function(a) {
		this.a = a;
	};
	JS.CommaList.prototype.compile = function() {
		return this.a.map(mCompile).join(',');
	};

	// Lib
	var Lib = {
		'_mod': new JS.ExprFn('_mod', [new JS.Name('x'), new JS.Name('y')],
			new JS.BinOp('%', new JS.BinOp('+', new JS.BinOp('%', new JS.Name('x'), new JS.Name('y')), new JS.Name('y')), new JS.Name('y')), true),
		'_range': new JS.Fn('_range', [new JS.Name('o')], [
			new JS.Prefix('var ', new JS.Assigment([
				new JS.Name('a'), new JS.Index(new JS.Name('o'), new JS.Number('0')), 
				new JS.Name('b'), new JS.Index(new JS.Name('o'), new JS.Number('1')), 
				new JS.Name('c'), new JS.Index(new JS.Name('o'), new JS.Number('2')), 
				new JS.Name('r'), new JS.Array([])
			])),
			new JS.If([
				new JS.BinOp('<=', new JS.Name('a'), new JS.Name('b')), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([new JS.Name('s'), new JS.BinOp('||', new JS.Name('c'), new JS.Number('1'))])),
					new JS.While(new JS.BinOp('<', new JS.Name('a'), new JS.Name('b')), new JS.Array([
						new JS.FnCall('r.push', [new JS.Name('a')]),
						new JS.BinOp('+=', new JS.Name('a'), new JS.Name('s'))
					]))
				]), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([new JS.Name('s'), new JS.BinOp('||', new JS.Name('c'), new JS.UnOp('-', new JS.Number('1')))])),
					new JS.While(new JS.BinOp('>', new JS.Name('a'), new JS.Name('b')), new JS.Array([
						new JS.FnCall('r.push', [new JS.Name('a')]),
						new JS.BinOp('+=', new JS.Name('a'), new JS.Name('s'))
					]))
				])
			]),
			new JS.Prefix('return ', new JS.Name('r'))
		], true),
	};
	function addLibTo(obj) {
		for(var k in Lib) obj[k] = eval('('+Lib[k].compile()+')');
	};
	var curLibs = {};
	function addLib(name) {curLibs[name] = true};
	function checkLib(name) {
		if(opLibsReq[name])
			for(var i = 0, a = opLibsReq[name], l = a.length; i < l; i++)
				addLib(a[i]);
	};
	var opLibsReq = {
		'@%': ['_mod'],
		'@to': ['_range'],
		'@til': ['_range'],
		'@range': ['_range'],
	};
	var opToLib = {
		'@%': '_mod',
		'@range': '_range'
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
		'%%': function(x, y) {return new JS.BinOp('==', new JS.BinOp('%', x, y), new JS.Number(0))},
		'@%': function(x, y) {return new JS.FnCall('_mod', [x, y])},
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
		// unary
		'@': function(l) {
			if(l instanceof JS.Array) {
				var a = l.val;
				if(a.length == 0) return new JS.ExprFn('', [new JS.Name('x')], new JS.Name('x'));
				if(a.length == 1) return new JS.ExprFn('', [], operators['@!'](a[0], new JS.Name('arguments')));
				var cur = operators['@!'](a[a.length-1], new JS.Name('arguments'));
				for(var i = a.length-2; i >= 0; i--)
					cur = new JS.FnCall(a[i], [cur]);
				return new JS.ExprFn('', [], cur);
			}
		},
		// binary
		'&': function(args, body) {return new JS.ExprFn('', wrap(args), body)},
		'@&': function(args, body) {return new JS.Fn('', wrap(args), wrap(body))},
		'!': function(fn, args) {return new JS.FnCall(fn, [args])},
		'@!': function(fn, list) {
			if(list instanceof JS.Array)
				return new JS.FnCall(fn, list.val);
			else return new JS.MethodCall(fn, 'apply', [new JS.Name('null'), list]);
		},
		'\\': function(bl, arg) {
			if(bl instanceof JS.Block) {
				checkLib(bl.val);
				if(!(arg instanceof JS.Array)) {
					if(opToLib[bl.val]) return operators['\\'](new JS.Name(opToLib[bl.val]), arg);
					else {
						for(var i = 0, n = operators[bl.val].length-1, args = []; i < n; i++) args.push(randVar());
						return new JS.ExprFn('', args, operators[bl.val].apply(null, bl.reversed? args.concat([arg]): [arg].concat(args)));
					}
				}
			} else return new JS.MethodCall(bl, 'bind', [new JS.Name('this'), arg]);
		},
		// ternary
		'!!': function(fn, x, y) {return new JS.FnCall(fn, [x, y])},

		// String
		// binary
		'@r': function(s, m) {return new JS.RegExp(s, m)},

		// Array
		// unary
		'@til': function(n) {
			return new JS.FnCall('_range', [new JS.Array([new JS.Number('0'), n])]);
		},
		'@to': function(n) {
			return new JS.FnCall('_range', [new JS.Array([new JS.Number('1'), new JS.BinOp('+', n, new JS.Number('1'))])]);
		},
		'@range': function(o) {
			return new JS.FnCall('_range', [o]);
		},
		// binary
		',': function(a, b) {return new JS.MethodCall(a instanceof JS.String || a instanceof JS.Number? new JS.Array([a]): a, 'concat', [b])},
		'!*': function(fn, a) {return new JS.MethodCall(a, 'map', [fn])},
		'!/': function(fn, a) {return new JS.MethodCall(a, 'reduce', [fn])},
		'!-': function(fn, a) {return new JS.MethodCall(a, 'filter', [fn])},
		'`': function(i, a) {return new JS.Index(a, i)},
		// ternary
		'@fold': function(fn, v, a) {return new JS.MethodCall(a, 'reduce', [fn, v])},

		// JS Keywords
		// unary
		'@return': function(x) {return new JS.Prefix('return ', x)},
		'@typeof': function(x) {return new JS.Prefix('typeof ', x)},
		'?': function(o) {return new JS.Ternary(o.val)},
		'@if': function(o) {return new JS.If(o.val)},
		'@:': function(o) {return new JS.Assigment(o.val)},
		'@var': function(o) {
			if(o instanceof JS.Object) return new JS.Prefix('var ', new JS.Assigment(o.val));
			if(o instanceof JS.Array) return new JS.Prefix('var ', new JS.CommaList(o.val));
		},
		// binary
		':': function(k, v) {return new JS.Assigment([k, v])},
		'@v': function(k, v) {return new JS.Prefix('var ', new JS.Assigment([k, v]))},
		'@new': function(x, a) {return new JS.Prefix('new ', new JS.FnCall(x, wrap(a)))},
		'@instanceof': function(x, y) {return new JS.BinOp(' instanceof ', x, y)},
		'@while': function(c, a) {return new JS.While(c, a)},
	
		// Wortel
		'~': function() {return new JS.Empty()},
		// unary
		'^': function(bl) {
			if(bl instanceof JS.Block) {
				checkLib(bl.val);
				if(opToLib[bl.val]) return new JS.Name(opToLib[bl.val]);
				else {
					for(var i = 0, n = operators[bl.val].length, args = []; i < n; i++) args.push(randVar());
					if(!bl.reversed) return new JS.ExprFn('', args, operators[bl.val].apply(null, args));
					else return new JS.ExprFn('', args, operators[bl.val].apply(null, [].concat(args).reverse()));
				}
			} else if(bl instanceof JS.Name) return new JS.Name('this.'+bl.val);
			else if(bl instanceof JS.Array) return new JS.Fn('', [], wrap(bl));
			return new JS.Empty();
		},
	};

	return {
		compile: compile,
		parse: parse,
		version: version,
		addLibTo: addLibTo
	};
})();

// Node.js
if(typeof global != 'undefined' && global) {
	// Export
	if(module && module.exports) module.exports = Wortel;
	// Commandline
	if(require.main === module) {
		var args = process.argv.slice(2), l = args.length;
		if(l === 0) {
			// REPL
			console.log('Wortel '+Wortel.version+' REPL');
			var PARSEMODE = 0, EVALMODE = 1, mode = EVALMODE;
			Wortel.addLibTo(global);
			process.stdin.setEncoding('utf8');
			function input() {
				process.stdout.write('> ');
				process.stdin.once('data', function(s) {
					try {
						if(s.trim() == 'setModeParse') mode = PARSEMODE;
						else if(s.trim() == 'setModeEval') mode = EVALMODE;
						else if(mode == PARSEMODE) console.log(Wortel.compile(s, true));
						else if(mode == EVALMODE) console.log(eval(Wortel.compile(s, true)));
					} catch(e) {
						console.log('Error: '+e);
					}
					input();
				}).resume();
			};
			input();
		} else {
			var f = args[0];
			if(f) {
				var fs = require('fs');
				fs.readFile(f, 'ascii', function(e, s) {
					if(e) console.log('Error: ', e);
					else {
						console.log(Wortel.compile(s));
					}
				});
			}
		}
	}
}
