/*
	Wortel
	@author: Albert ten Napel
	@version: 0.66.8
	@date: 2013-11-8

	TODO:
		write unit tests		

		?mixins
		?macro/aliases

		all/any/none/one
		allf/anyf/nonef/onef
*/

var Wortel = (function() {
	var version = '0.66.8';
	var _randN = 0;
	function randVar() {return new JS.Name('_'+(_randN++))}
		
	// Parser
	var symbols = '~`!@#%^&*-+=|\\:?/><,';
	var quoteSymbols = ['\\', '\\\\', '^', '%^', ':!'];
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
			if(c.type == 'symbol' && quoteSymbols.indexOf(c.val) != -1 && r[i+1].type == 'symbol' && quoteSymbols.indexOf(r[i+1].val) == -1)
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
		var lib = [], astc = ast.map(mCompile).filter(function(x) {return x});
		if(sub) 
			return astc.join(';');
	 	else {
			for(var k in curLibs) lib.push(Lib[k].compile());
			return '(function(){'+lib.concat(astc).filter(function(x) {return x}).join(';')+'})()';
		}
	};

	function compile(s, sub) {return toJS(parse(s), sub)};

	// MathFn and Pointer Expr
	function compilePointerExpr(expr, inp, fn, st) {
		var expr = expr.replace(/\_|\s/g, '');
		var inp = inp || [], x = inp[0] || new JS.Name('x'),
							y = inp[1] || new JS.Name('y'), z = inp[2] || new JS.Name('z');
		var stack = st? inp: inp.length > 3? [].concat(inp).reverse(): [z, y, x];
		var a = expr.match(/\$[0-9a-zA-Z\.]+\$|k[0-9]+|[0-9]+\.[0-9]+|[0-9]+|[a-zA-Z]/g);
		for(var i = 0, l = a.length, t; i < l; i++) {
			var c = a[i], n = +c;
			if(c[0] == '$') compileMathFnRPN(c.slice(1, -1), stack, false, true);
			if(!isNaN(n)) stack.push(new JS.Number(n));
			else if(c == 'a') addLib('_sum'), stack.push(new JS.FnCall('_sum', [stack.pop()]));
			else if(c == 'b') addLib('_prod'), stack.push(new JS.FnCall('_prod', [stack.pop()]));
			else if(c == 'c') stack.push(new JS.Prop(stack.pop(), new JS.Name('length')));
			else if(c == 'd') stack.push(stack[stack.length-1]);
			else if(c == 'e') ;
			else if(c == 'f') addLib('_flat'), stack.push(new JS.FnCall('_flat', [stack.pop()]));
			else if(c == 'g') ;
			else if(c == 'h') stack.push(new JS.Index(stack.pop(), new JS.Number('0')));
			else if(c == 'i') stack.push(new JS.MethodCall(stack.pop(), 'slice', [new JS.Number('0'), new JS.UnOp('-', new JS.Number('1'))]));
			else if(c == 'j') t = stack.pop(), stack.push(new JS.MethodCall(stack.pop(), 'concat', [t]));
			else if(c == 'k') ;
			else if(c == 'l') addLib('_last'), stack.push(new JS.FnCall('_last', [stack.pop()]));
			else if(c == 'm') addLib('_maxl'), stack.push(new JS.FnCall('_maxl', [stack.pop()]));
			else if(c == 'n') addLib('_minl'), stack.push(new JS.FnCall('_minl', [stack.pop()]));
			else if(c == 'o') addLib('_sort'), stack.push(new JS.FnCall('_sort', [stack.pop()]));
			else if(c == 'p') addLib('_zip'), t = stack.pop(), stack.push(new JS.FnCall('_zip', [stack.pop(), t]));
			else if(c == 'q') t = stack.pop(), stack.push(new JS.BinOp('==', stack.pop(), t));
			else if(c == 'r') addLib('_rev'), stack.push(new JS.FnCall('_rev', [stack.pop()]));
			else if(c == 's') ; // no-op
			else if(c == 't') stack.push(new JS.MethodCall(stack.pop(), 'slice', [new JS.Number('1')]));
			else if(c == 'u') addLib('_uniq'), stack.push(new JS.FnCall('_uniq', [stack.pop()]));
			else if(c == 'v') ;
			else if(c == 'w') stack.push(new JS.Array([stack.pop()]));
			else if(c == 'x') ;
			else if(c == 'y') t = [stack.pop(), stack.pop(), stack.pop()], stack.push(t[1], t[0], t[2]);
			else if(c == 'z') t = [stack.pop(), stack.pop(), stack.pop()], stack.push(t[0], t[2], t[1]);
			else if(c == 'A') addLib('_range'), stack.push(new JS.FnCall('_range', [new JS.Array([new JS.Number('1'), stack.pop()])]));
			else if(c == 'B') addLib('_range'), stack.push(new JS.FnCall('_range', [new JS.Array([new JS.Number('0'), new JS.BinOp('-', stack.pop(), new JS.Number('1'))])]));
			else if(c == 'C') stack.push(stack[stack.length-2]);
			else if(c == 'D') stack.pop();
			else if(c == 'E') ;
			else if(c == 'F') ;
			else if(c == 'G') ;
			else if(c == 'H') ;
			else if(c == 'I') t = stack.pop(), stack.push(new JS.Index(stack.pop(), t));
			else if(c == 'J') ;
			else if(c == 'K') stack.push(new JS.Array(stack.slice(-stack.pop().val)));
			else if(c == 'L') ;
			else if(c == 'M') ;
			else if(c == 'N') ;
			else if(c == 'O') t = stack.pop(), stack.push(new JS.MethodCall(new JS.Array([stack.pop()]), 'concat', [t]));
			else if(c == 'P') addLib('_part'), stack.push(new JS.FnCall('_part', [stack.pop(), stack.pop()]));
			else if(c == 'Q') t = stack.pop(), stack.push(new JS.BinOp('===', stack.pop(), t));
			else if(c == 'R') addLib('_range'), stack.push(new JS.FnCall('_range', [stack.pop()]));
			else if(c == 'S') t = stack.pop(), stack.push(t, stack.pop());
			else if(c == 'T') t = stack.pop(), stack.push(new JS.MethodCall(stack.pop(), 'slice', [new JS.Number('0'), t]));
			else if(c == 'U') ;
			else if(c == 'V') ;
			else if(c == 'W') addLib('_wrap'), stack.push(new JS.FnCall('_wrap', [stack.pop()]));
			else if(c == 'X') stack.push(x);
			else if(c == 'Y') stack.push(y);
			else if(c == 'Z') stack.push(z);
		}
		return !fn? stack[stack.length-1]: new JS.ExprFn('', [new JS.Name('x'), new JS.Name('y'), new JS.Name('z')], stack[stack.length-1]);
	};

	function compileNumber(val) {
		var str = val.replace(/\$|\_/g, '');
		if(/^(0x[0-9af]+|0[0-7]+)$/i.test(str)) return str;
		if(/^[0-9]+x/.test(str)) {
			var f = str.match(/^[0-9]+x/)[0];
			return ''+parseInt(str.slice(f.length), f.slice(0, -1));
		}
		if(/^[0-9]*\.[0-9]+$|^[0-9]+$/.test(str)) return str;
		return compileMathFnRPN(val).compile();
	};
	function compileMathFnRPN(expr, inp, fn, st) {
		var expr = expr.replace(/\$|\_|\s/g, '');
		var inp = inp || [], x = inp[0] || new JS.Name('x'),
							y = inp[1] || new JS.Name('y'), z = inp[2] || new JS.Name('z');
		var stack = st? inp: inp.length > 3? [].concat(inp).reverse(): [z, y, x];
		var a = expr.match(/k[0-9]+|[0-9]+\.[0-9]+|[0-9]+|[a-zA-Z]/g);
		for(var i = 0, l = a.length, t; i < l; i++) {
			var c = a[i], n = +c;
			if(!isNaN(n)) stack.push(new JS.Number(n));
			else if(c == 'a') t = stack.pop(), stack.push(new JS.BinOp('+', stack.pop(), t));
			else if(c == 'b') t = stack.pop(), stack.push(new JS.BinOp('-', stack.pop(), t));
			else if(c == 'c') stack.push(new JS.FnCall('Math.ceiling', [stack.pop()]));
			else if(c == 'd') stack.push(stack[stack.length-1]);
			else if(c == 'e') t = stack.pop(), stack.push(new JS.BinOp('*', stack.pop(), new JS.FnCall('Math.pow', [new JS.Number('10'), t])));
			else if(c == 'f') stack.push(new JS.FnCall('Math.floor', [stack.pop()]));
			else if(c == 'g') t = stack.pop(), stack.push(new JS.BinOp('>', stack.pop(), t));
			else if(c == 'h') stack.push(new JS.BinOp('/', stack.pop(), new JS.Number('2')));
			else if(c == 'i') stack.push(new JS.BinOp('+', stack.pop(), new JS.Number('1')));
			else if(c == 'j') stack.push(new JS.BinOp('-', stack.pop(), new JS.Number('1')));
			else if(c == 'k') ;
			else if(c == 'l') t = stack.pop(), stack.push(new JS.BinOp('<', stack.pop(), t));
			else if(c == 'm') t = stack.pop(), stack.push(new JS.BinOp('*', stack.pop(), t));
			else if(c == 'n') t = stack.pop(), stack.push(new JS.BinOp('/', stack.pop(), t));
			else if(c == 'o') stack.push(new JS.BinOp('*', stack.pop(), new JS.Number('2')));
			else if(c == 'p') t = stack.pop(), stack.push(new JS.FnCall('Math.pow', [stack.pop(), t]));
			else if(c == 'q') t = stack.pop(), stack.push(new JS.BinOp('==', stack.pop(), t));
			else if(c == 'r') stack.push(new JS.FnCall('Math.round', [stack.pop()]));
			else if(c == 's') ; // no-op
			else if(c == 't') t = stack.pop(), stack.push(new JS.BinOp('>=', stack.pop(), t));
			else if(c == 'u') t = stack.pop(), stack.push(new JS.BinOp('<=', stack.pop(), t));
			else if(c == 'v') stack.push(new JS.FnCall('Math.sqrt', [stack.pop()]));
			else if(c == 'w') ;
			else if(c == 'x') t = stack.pop(), stack.push(new JS.BinOp('^', stack.pop(), t));
			else if(c == 'y') t = [stack.pop(), stack.pop(), stack.pop()], stack.push(t[1], t[0], t[2]);
			else if(c == 'z') t = [stack.pop(), stack.pop(), stack.pop()], stack.push(t[0], t[2], t[1]);
			else if(c == 'A') t = stack.pop(), stack.push(new JS.BinOp('&', stack.pop(), t));
			else if(c == 'B') stack.push(new JS.BinOp('*', stack.pop(), new JS.Number('1000000000')));
			else if(c == 'C') stack.push(stack[stack.length-2]);
			else if(c == 'D') stack.pop();
			else if(c == 'E') stack.push(new JS.Name('Math.E'));
			else if(c == 'F') addLib('_fac'), stack.push(new JS.FnCall('_fac', [stack.pop()]));
			else if(c == 'G') stack.push(new JS.FnCall('Math.max', [stack.pop(), stack.pop()]));
			else if(c == 'H') stack.push(new JS.BinOp('*', stack.pop(), new JS.Number('100')));
			else if(c == 'I') stack.push(new JS.FnCall('Math.abs', [stack.pop()]));
			else if(c == 'J') ;
			else if(c == 'K') stack.push(new JS.BinOp('*', stack.pop(), new JS.Number('1000')));
			else if(c == 'L') stack.push(new JS.FnCall('Math.min', [stack.pop(), stack.pop()]));
			else if(c == 'M') stack.push(new JS.BinOp('*', stack.pop(), new JS.Number('1000000')));
			else if(c == 'N') stack.push(new JS.BinOp('*', stack.pop(), new JS.UnOp('-', new JS.Number('1'))));
			else if(c == 'O') t = stack.pop(), stack.push(new JS.BinOp('|', stack.pop(), t));
			else if(c == 'P') stack.push(new JS.Name('Math.PI'));
			else if(c == 'Q') t = stack.pop(), stack.push(new JS.BinOp('===', stack.pop(), t));
			else if(c == 'R') t = stack.pop(), stack.push(new JS.BinOp('%', stack.pop(), t));
			else if(c == 'S') t = stack.pop(), stack.push(t, stack.pop());
			else if(c == 'T') stack.push(new JS.BinOp('*', stack.pop(), new JS.Number('10')));
			else if(c == 'U') ;
			else if(c == 'V') addLib('_sq'), stack.push(new JS.FnCall('_sq', [stack.pop()]));
			else if(c == 'W') ;
			else if(c == 'X') stack.push(x);
			else if(c == 'Y') stack.push(y);
			else if(c == 'Z') stack.push(z);
		}
		return !fn? stack[stack.length-1]: new JS.ExprFn('', [new JS.Name('x'), new JS.Name('y'), new JS.Name('z')], stack[stack.length-1]);
	};

	// Expr
	function toString(x) {return x.toString()};
	function mCompile(x) {return x.compile()};
	var JS = {};
	// Number
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
		var t = this.val.replace(/\.\.\./g, '.prototype.'); 
		t = t.replace(/(\.[0-9][0-9a-z]*\.)|(\.[0-9][0-9a-z]*$)/gi,
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
	// SemiGroup
	JS.SemiGroup = function(a) {
		this.val = a;
	};
	JS.SemiGroup.prototype.compile = function() {
		return this.val.length == 0? '': this.val.map(mCompile).join(';');
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
	// BinOpL
	JS.BinOpL = function(op, a) {
		this.op = op;
		this.a = a;
	};
	JS.BinOpL.prototype.compile = function() {
		return '('+this.a.map(mCompile).join(this.op)+')';
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
		return (typeof this.fn == 'string'? this.fn: this.fn instanceof JS.Name? this.fn.compile(): '('+this.fn.compile()+')')+'('+this.args.map(mCompile).join(',')+')';
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
		this.body = !body? [new JS.Empty()]: Array.isArray(body)? body: [body];
		this.statement = statement || false;
	};
	JS.ExprFn.prototype.compile = function() {
		var last = this.args[this.args.length-1], rest;
		if(last instanceof JS.Block && last.val == '~')
			rest = last.args[0], this.args = this.args.slice(0, -1);
		var s = 'function '+(!this.name? '': typeof this.name == 'string'? this.name: this.name.compile())+
				'('+this.args.map(mCompile).join(',')+'){'+(!rest?'': 'var '+rest.compile()+'=Array.prototype.slice.call(arguments,'+this.args.length+');')+
					this.body.slice(0, -1).map(mCompile).join(';')+
					';return '+this.body[this.body.length-1].compile()+'}';
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
		var last = this.args[this.args.length-1], rest;
		if(last instanceof JS.Block && last.val == '~')
			rest = last.args[0], this.args = this.args.slice(0, -1);
		var s = 'function '+(!this.name? '': typeof this.name == 'string'? this.name: this.name.compile())+
				'('+this.args.map(mCompile).join(',')+'){'+(!rest?'': 'var '+rest.compile()+'=Array.prototype.slice.call(arguments,'+this.args.length+');')+
				this.body.map(mCompile).join(';')+'}';
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
	// Suffix
	JS.Suffix = function(p, x) {
		this.p = p;
		this.x = x;
	};
	JS.Suffix.prototype.compile = function() {return this.x.compile()+this.p};
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
	// For
	JS.For = function(a, b, c, body) {
		this.a = a || new JS.Empty();
		this.b = b || new JS.Empty();
		this.c = c || new JS.Empty();
		this.body = body || new JS.Array([]);
	};
	JS.For.prototype.compile = function() {
		return 'for('+[this.a, this.b, this.c].map(mCompile).join(';')+'){'+compileArray(this.body)+'}';
	};
	// ForIn
	JS.ForIn = function(a, b, body) {
		this.a = a || new JS.Empty();
		this.b = b || new JS.Empty();
		this.body = body || new JS.Array([]);
	};
	JS.ForIn.prototype.compile = function() {
		return 'for('+[this.a, this.b].map(mCompile).join(' in ')+'){'+compileArray(this.body)+'}';
	};
	// Assigment
	JS.Assigment = function(o) {
		this.o = o;
	};
	JS.Assigment.prototype.compile = function() {
		for(var i = 0, a = this.o, l = a.length, r = []; i < l; i += 2) {
			var k = a[i], v = a[i+1];
			if(k instanceof JS.Array)
				r.push(k.val.map(mCompile).join('=')+'='+v.compile());
			else r.push(k.compile() + '=' + v.compile());
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
	// Prop
	JS.Prop = function(o, p) {
		this.o = o;
		this.p = p;
	};
	JS.Prop.prototype.compile = function() {
		return '('+this.o.compile() + ').' + this.p.compile();
	};

	// Lib
	var Lib = {
		'_extends': (function() {
			var a = new JS.Name('a'),
					b = new JS.Name('b'),
					p = new JS.Name('p');
			return new JS.Fn('_extends', [a, b], [
				new JS.ForIn(new JS.Prefix('var ', p), b, new JS.Array([
					new JS.If([
						new JS.FnCall('b.hasOwnProperty', [p]), new JS.Assigment([new JS.Index(a, p), new JS.Index(b, p)])
					])
				])),
				new JS.Fn('__', [], [new JS.Assigment([new JS.Name('this.constructor'), a])], true),
				new JS.Assigment([new JS.Name('__.prototype'), new JS.Name('b.prototype')]),
				new JS.Assigment([new JS.Name('a.prototype'), new JS.Prefix('new ', new JS.FnCall(new JS.Name('__'), []))])
			], true);
		})(),
		'_fac': (function() {
			var n = new JS.Name('n'),
					i = new JS.Name('i'),
					r = new JS.Name('r');
			return new JS.Fn('_fac', [n], [
				new JS.Prefix('var ', new JS.Assigment([r, new JS.Number('1')])),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('1')])), new JS.BinOp('<=', i, n), new JS.Suffix('++', i), new JS.Array([
					new JS.BinOp('*=', r, i)
				])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_table': (function() {
			var f = new JS.Name('f'),
					a = new JS.Name('a'),
					b = new JS.Name('b'),
					i = new JS.Name('i'),
					j = new JS.Name('j'),
					la = new JS.Name('la'),
					lb = new JS.Name('lb'),
					r = new JS.Name('r'),
					x = new JS.Name('x'),
					len = new JS.Name('length');
			return new JS.Fn('_table', [f, a, b], [
				new JS.Prefix('var ', new JS.Assigment([
					la, new JS.Prop(a, len),
					lb, new JS.Prop(b, len),
					r, new JS.Array([]),
				])),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0')])), new JS.BinOp('<', i, la), new JS.Suffix('++', i), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([x, new JS.Array([])])),
					new JS.For(new JS.Prefix('var ', new JS.Assigment([j, new JS.Number('0')])), new JS.BinOp('<', j, lb), new JS.Suffix('++', j), new JS.Array([
						new JS.FnCall('x.push', [new JS.FnCall('f', [new JS.Index(a, i), new JS.Index(b, j)])])])),
					new JS.FnCall('r.push', [x])])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_cartm': (function() {
			var m = new JS.Name('m'),
					l = new JS.Name('l'),
					max = new JS.Name('max'),
					i = new JS.Name('i'),
					j = new JS.Name('j'),
					r = new JS.Name('r'),
					a = new JS.Name('a'),
					arr = new JS.Name('arr'),
					len = new JS.Name('length');
			return new JS.Fn('_cartm', [m], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(m, len)), new JS.Prefix('return ', new JS.Array([]))
				]),
				new JS.Prefix('var ', new JS.Assigment([
					max, new JS.BinOp('-', new JS.Prop(m, len), new JS.Number('1')),
					r, new JS.Array([])
				])),
				new JS.Fn('_helper', [arr, i], [
					new JS.For(new JS.Prefix('var ', new JS.Assigment([
						j, new JS.Number('0'),
						l, new JS.Prop(new JS.Index(m, i), len)
					])), new JS.BinOp('<', j, l), new JS.Suffix('++', j), new JS.Array([
						new JS.Prefix('var ', new JS.Assigment([a, new JS.FnCall('arr.slice', [new JS.Number('0')])])),
						new JS.FnCall('a.push', [new JS.Index(new JS.Index(m, i), j)]),
						new JS.If([
							new JS.BinOp('==', i, max), new JS.FnCall('r.push', [a]), new JS.FnCall('_helper', [a, new JS.BinOp('+', i, new JS.Number('1'))])
						])
					]))
				], true),
				new JS.FnCall('_helper', [new JS.Array([]), new JS.Number('0')]),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_mapm': (function() {
			var m = new JS.Name('m'),
					l = new JS.Name('l'),
					f = new JS.Name('f'),
					min = new JS.Name('min'),
					i = new JS.Name('i'),
					j = new JS.Name('j'),
					r = new JS.Name('r'),
					x = new JS.Name('x'),
					y = new JS.Name('y'),
					len = new JS.Name('length');
			return new JS.Fn('_mapm', [f, m], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(m, len)), new JS.Prefix('return ', new JS.Array([]))
				]),
				new JS.Prefix('var ', new JS.Assigment([
					l, new JS.Prop(m, len),
					r, new JS.Array([]),
					min, new JS.FnCall('m.reduce', [new JS.ExprFn('', [x, y], new JS.FnCall('Math.min', [x, new JS.Prop(y, len)])), new JS.Name('Infinity')])
				])),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0')])), new JS.BinOp('<', i, min), new JS.Suffix('++', i), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([x, new JS.Array([])])),
					new JS.For(new JS.Prefix('var ', new JS.Assigment([j, new JS.Number('0')])), new JS.BinOp('<', j, l), new JS.Suffix('++', j), new JS.Array([
						new JS.FnCall('x.push', [new JS.Index(new JS.Index(m, j), i)])])),
					new JS.FnCall('r.push', [new JS.FnCall('f.apply', [new JS.Name('this'), x])])
				])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_zipm': (function() {
			var m = new JS.Name('m'),
					l = new JS.Name('l'),
					min = new JS.Name('min'),
					i = new JS.Name('i'),
					j = new JS.Name('j'),
					r = new JS.Name('r'),
					x = new JS.Name('x'),
					y = new JS.Name('y'),
					len = new JS.Name('length');
			return new JS.Fn('_zipm', [m], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(m, len)), new JS.Prefix('return ', new JS.Array([]))
				]),
				new JS.Prefix('var ', new JS.Assigment([
					l, new JS.Prop(m, len),
					r, new JS.Array([]),
					min, new JS.FnCall('m.reduce', [new JS.ExprFn('', [x, y], new JS.FnCall('Math.min', [x, new JS.Prop(y, len)])), new JS.Name('Infinity')])
				])),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0')])), new JS.BinOp('<', i, min), new JS.Suffix('++', i), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([x, new JS.Array([])])),
					new JS.For(new JS.Prefix('var ', new JS.Assigment([j, new JS.Number('0')])), new JS.BinOp('<', j, l), new JS.Suffix('++', j), new JS.Array([
						new JS.FnCall('x.push', [new JS.Index(new JS.Index(m, j), i)])])),
					new JS.FnCall('r.push', [x])
				])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_rep': (function() {
			var n = new JS.Name('n'),
					r = new JS.Name('r'),
					v = new JS.Name('v'),
					i = new JS.Name('i'),
					a = new JS.Name('a');
			return new JS.Fn('_rep', [n, v], [
				new JS.Prefix('var ', new JS.Assigment([a, new JS.FnCall('Array.isArray', [v])])),
				new JS.If([
					new JS.BinOp('&&', a,
						new JS.BinOp('==', new JS.Number('0'), new JS.Prop(v, new JS.Name('length')))), new JS.Prefix('return ', new JS.Array([]))
				]),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('0'),
					r, new JS.Array([]),
				])), new JS.BinOp('<', i, n), new JS.Suffix('++', i), new JS.Array([new JS.FnCall('r.push', [new JS.Ternary([
					a, new JS.Index(v, new JS.BinOp('%', i, new JS.Prop(v, new JS.Name('length')))), v
				])])])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_sum': (function() {
			var a = new JS.Name('a'),
					n = new JS.Name('n'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_sum', [a], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(a, new JS.Name('length'))), new JS.Prefix('return ', new JS.Number('0'))
				]),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('1'),
					n, new JS.Index(a, new JS.Number('0')),
					l, new JS.Prop(a, new JS.Name('length'))
				])), new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([new JS.BinOp('+=', n, new JS.Index(a, i))])),
				new JS.Prefix('return ', n)
			], true);
		})(),
		'_maxl': (function() {
			var a = new JS.Name('a'),
					m = new JS.Name('m'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_maxl', [a], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(a, new JS.Name('length'))), new JS.Prefix('return ', new JS.UnOp('-', new JS.Name('Infinity')))
				]),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('1'),
					m, new JS.Index(a, new JS.Number('0')),
					l, new JS.Prop(a, new JS.Name('length'))
				])), new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
					new JS.If([
						new JS.BinOp('>', new JS.Index(a, i), m), new JS.Assigment([m, new JS.Index(a, i)])
					])
				])),
				new JS.Prefix('return ', m)
			], true);
		})(),
		'_maxf': (function() {
			var a = new JS.Name('a'),
					f = new JS.Name('f'),
					v = new JS.Name('v'),
					mv = new JS.Name('mv'),
					mi = new JS.Name('mi'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_maxf', [f, a], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(a, new JS.Name('length'))), new JS.Prefix('return ', new JS.UnOp('-', new JS.Name('Infinity')))
				]),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('0'),
					mv, new JS.UnOp('-', new JS.Name('Infinity')),
					mi, new JS.UnOp('-', new JS.Number('1')),
					l, new JS.Prop(a, new JS.Name('length'))
				])), new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([
						v, new JS.FnCall(f, [new JS.Index(a, i)])
					])),
					new JS.If([
						new JS.BinOp('>', v, mv), new JS.Assigment([mv, v, mi, i])
					])
				])),
				new JS.Prefix('return ', new JS.Index(a, mi))
			], true);
		})(),
		'_minl': (function() {
			var a = new JS.Name('a'),
					m = new JS.Name('m'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_maxl', [a], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(a, new JS.Name('length'))), new JS.Prefix('return ', new JS.Name('Infinity'))
				]),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('1'),
					m, new JS.Index(a, new JS.Number('0')),
					l, new JS.Prop(a, new JS.Name('length'))
				])), new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
					new JS.If([
						new JS.BinOp('<', new JS.Index(a, i), m), new JS.Assigment([m, new JS.Index(a, i)])
					])
				])),
				new JS.Prefix('return ', m)
			], true);
		})(),
		'_minf': (function() {
			var a = new JS.Name('a'),
					f = new JS.Name('f'),
					v = new JS.Name('v'),
					mv = new JS.Name('mv'),
					mi = new JS.Name('mi'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_minf', [f, a], [
				new JS.If([
					new JS.BinOp('==', new JS.Number('0'), new JS.Prop(a, new JS.Name('length'))), new JS.Prefix('return ', new JS.Name('Infinity'))
				]),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('0'),
					mv, new JS.Name('Infinity'),
					mi, new JS.UnOp('-', new JS.Number('1')),
					l, new JS.Prop(a, new JS.Name('length'))
				])), new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([
						v, new JS.FnCall(f, [new JS.Index(a, i)])
					])),
					new JS.If([
						new JS.BinOp('<', v, mv), new JS.Assigment([mv, v, mi, i])
					])
				])),
				new JS.Prefix('return ', new JS.Index(a, mi))
			], true);
		})(),
		'_prod': (function() {
			var a = new JS.Name('a'),
					n = new JS.Name('n'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_prod', [a], [
				new JS.For(new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('0'),
					n, new JS.Number('1'),
					l, new JS.Prop(a, new JS.Name('length'))
				])), new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([new JS.BinOp('*=', n, new JS.Index(a, i))])),
				new JS.Prefix('return ', n)
			], true);
		})(),
		'_wrap': new JS.Fn('_wrap', [new JS.Name('x')], [new JS.Prefix('return ', new JS.Ternary([
			new JS.FnCall('Array.isArray', [new JS.Name('x')]), new JS.Name('x'), new JS.Array([new JS.Name('x')])
		]))], true),
		'_flat': (function() {
			var a = new JS.Name('a'),
					r = new JS.Name('r'),
					i = new JS.Name('i'),
					j = new JS.Name('j'),
					l = new JS.Name('l'),
					k = new JS.Name('k'),
					len = new JS.Name('length');
			return new JS.Fn('_flat', [a], [
				new JS.Prefix('var ', new JS.Assigment([r, new JS.Array([])])),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0'), l, new JS.Prop(a, len)])), new JS.BinOp('<', i, l),
					new JS.Suffix('++', i), new JS.Array([
						new JS.For(new JS.Prefix('var ', new JS.Assigment([j, new JS.Number('0'), k, new JS.Prop(new JS.Index(a, i), len)])), new JS.BinOp('<', j, k),
							new JS.Suffix('++', j), new JS.Array([
								new JS.FnCall('r.push', [new JS.Index(new JS.Index(a, i), j)])
							]))
					])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_cart': (function() {
			var a = new JS.Name('a'),
					b = new JS.Name('b'),
					r = new JS.Name('r'),
					i = new JS.Name('i'),
					j = new JS.Name('j'),
					l = new JS.Name('l');
					k = new JS.Name('k'),
					len = new JS.Name('length');
			return new JS.Fn('_cart', [a, b], [
				new JS.Prefix('var ', new JS.Assigment([r, new JS.Array([])])),
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0'), l, new JS.Prop(a, len)])),
					new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
						new JS.For(new JS.Prefix('var ', new JS.Assigment([j, new JS.Number('0'), k, new JS.Prop(b, len)])),
							new JS.BinOp('<', j, k), new JS.Suffix('++', j), new JS.Array([
							new JS.FnCall('r.push', [new JS.Array([new JS.Index(a, i), new JS.Index(b, j)])])]))])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_uniq': (function() {
			var a = new JS.Name('a'),
					b = new JS.Name('b'),
					r = new JS.Name('r'),
					i = new JS.Name('i'),
					l = new JS.Name('l');
			return new JS.Fn('_uniq', [a], [
				new JS.Prefix('var ', new JS.Assigment([
					a, new JS.MethodCall(a, 'sort', [new JS.ExprFn('', [a, b], new JS.BinOp('-', a, b))]),
					r, new JS.Array([new JS.Index(a, new JS.Number('0'))]),
					i, new JS.Number('1'),
					l, new JS.Prop(a, new JS.Name('length'))
				])),
				new JS.For(null, new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
					new JS.If([
						new JS.BinOp('!==', new JS.Index(a, new JS.BinOp('-', i, new JS.Number('1'))), new JS.Index(a, i)),
							new JS.FnCall('r.push', [new JS.Index(a, i)])
					])
				])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_zip': (function() {
			var a = new JS.Name('a'),
					b = new JS.Name('b'),
					i = new JS.Name('i'),
					l = new JS.Name('l'),
					r = new JS.Name('r'),
					len = new JS.Name('length');
			return new JS.Fn('_zip', [a, b], [
				new JS.Prefix('var ', new JS.Assigment([
					i, new JS.Number('0'),
					l, new JS.FnCall('Math.min', [new JS.Prop(a, len), new JS.Prop(b, len)]),
					r, new JS.Array([])
				])),
				new JS.While(new JS.BinOp('<', i, l), new JS.Array([
					new JS.FnCall('r.push', [new JS.Array([new JS.Index(a, i), new JS.Index(b, i)])]),
					new JS.Suffix('++', i)
				])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_part': (function() {
			var a = new JS.Name('a'),
					n = new JS.Name('n'),
					r = new JS.Name('r'),
					i = new JS.Name('i');
			return new JS.Fn('_part', [n, a], [
				new JS.Prefix('var ', new JS.Assigment([
					r, new JS.Array([]),
					i, new JS.BinOp('|', new JS.Number('0'), new JS.BinOp('/', new JS.Prop(a, new JS.Name('length')), n))
				])),
				new JS.While(new JS.BinOp('>', new JS.Suffix('--', i), new JS.Number('0')), new JS.Array([
					new JS.Assigment([
						new JS.Index(r, i), new JS.FnCall('a.slice', [new JS.BinOp('*', i, n), new JS.BinOp('*', new JS.BinOp('+', i, new JS.Number('1')), n)])
					])
				])),
				new JS.Prefix('return ', r)
			], true);
		})(),
		'_rangef': (function() {
			var b = new JS.Name('b'), 
					f = new JS.Name('f'), 
					w = new JS.Name('w'), 
					r = new JS.Name('r'), 
					l = new JS.Name('l'), 
					i = new JS.Name('i'), 
					len = new JS.Name('length');
			return new JS.Fn('_rangef', [b, f, w], [
				new JS.Prefix('var ', new JS.Assigment([
					r, new JS.Ternary([new JS.FnCall('Array.isArray', [b]), b, new JS.Array([b])]),
					l, new JS.UnOp('-', new JS.Prop(f, len)),
					i, new JS.BinOp('-', new JS.Prop(r, len), new JS.Number('1'))
				])),
				new JS.While(new JS.FnCall(w, [new JS.Index(r, new JS.BinOp('-', new JS.Prop(r, len), new JS.Number('1'))), i]), new JS.Array([
					new JS.FnCall('r.push', [new JS.FnCall('f.apply', [new JS.Name('this'), new JS.FnCall('r.slice', [l])])]),
					new JS.BinOp('+=', i, new JS.Number('1'))
				])),
				new JS.Prefix('return ', r)
			], true)
		})(),
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
					new JS.While(new JS.BinOp('<=', new JS.Name('a'), new JS.Name('b')), new JS.Array([
						new JS.FnCall('r.push', [new JS.Name('a')]),
						new JS.BinOp('+=', new JS.Name('a'), new JS.Name('s'))
					]))
				]), new JS.Array([
					new JS.Prefix('var ', new JS.Assigment([new JS.Name('s'), new JS.BinOp('||', new JS.Name('c'), new JS.UnOp('-', new JS.Number('1')))])),
					new JS.While(new JS.BinOp('>=', new JS.Name('a'), new JS.Name('b')), new JS.Array([
						new JS.FnCall('r.push', [new JS.Name('a')]),
						new JS.BinOp('+=', new JS.Name('a'), new JS.Name('s'))
					]))
				])
			]),
			new JS.Prefix('return ', new JS.Name('r'))
		], true),
		'_sq': new JS.Fn('_sq', [new JS.Name('x')], [new JS.Prefix('return ', new JS.BinOp('*', new JS.Name('x'), new JS.Name('x')))], true),
		'_last': new JS.Fn('_last', [new JS.Name('a')], [new JS.Prefix('return ', new JS.Index(new JS.Name('a'), new JS.BinOp('-', new JS.Prop(new JS.Name('a'), new JS.Name('length')), new JS.Number('1'))))], true),
		'_rev': new JS.Fn('_rev', [new JS.Name('a')], [
			new JS.Prefix('return ', new JS.Ternary([
				new JS.BinOp('==', new JS.UnOp('typeof ', new JS.Name('a')), new JS.String('string', "'")),
				new JS.MethodCall(new JS.MethodCall(new JS.MethodCall(new JS.Name('a'), 'split', [new JS.String('', "'")]), 'reverse', []), 'join', [new JS.String('', "'")]),
				new JS.MethodCall(new JS.MethodCall(new JS.Array([]), 'concat', [new JS.Name('a')]), 'reverse', [])
			]))
		], true),
		'_sort': new JS.Fn('_sort', [new JS.Name('a')], [
			new JS.Prefix('return ', new JS.MethodCall(new JS.MethodCall(new JS.Array([]), 'concat', [new JS.Name('a')]), 'sort', [
				new JS.ExprFn('', [new JS.Name('a'), new JS.Name('b')], new JS.BinOp('-', new JS.Name('a'), new JS.Name('b')))
			]))
		], true),
		'_sortl': new JS.Fn('_sortl', [new JS.Name('a')], [
			new JS.Prefix('return ', new JS.MethodCall(new JS.MethodCall(new JS.Array([]), 'concat', [new JS.Name('a')]), 'sort', []))
		], true),
		'_sortf': new JS.Fn('_sortf', [new JS.Name('f'), new JS.Name('a')], [
			new JS.Prefix('return ', new JS.MethodCall(new JS.MethodCall(new JS.Array([]), 'concat', [new JS.Name('a')]), 'sort', [new JS.Name('f')]))
		], true),
		'_index': new JS.Fn('_index', [new JS.Name('i'), new JS.Name('a')], [
			new JS.Prefix('return ', new JS.Index(new JS.Name('a'), new JS.FnCall('_mod', [new JS.Name('i'), new JS.Prop(new JS.Name('a'), new JS.Name('length'))])))
		], true),
		'_mem': (function() {
			var f = new JS.Name('f'),
					c = new JS.Name('c'),
					x = new JS.Name('x');
			return new JS.Fn('_mem', [new JS.Name('f')], [
				new JS.Prefix('var ', new JS.Assigment([c, new JS.Object([])])),
				new JS.Prefix('return ', new JS.Fn('', [x], [
					new JS.If([new JS.BinOp(' in ', x, c), new JS.Prefix('return ', new JS.Index(c, x))]),
					new JS.Prefix('return ', new JS.Assigment([new JS.Index(c, x), new JS.FnCall(f, [x])]))
				]))
			], true);
		})(),
		'_neq': new JS.ExprFn('_neq', [new JS.Name('a'), new JS.Name('b')],
			new JS.UnOp('!', new JS.FnCall('_eq', [new JS.Name('a'), new JS.Name('b')])), true),
		'_eq': (function() {
			var a = new JS.Name('a'),
					b = new JS.Name('b'),
					ak = new JS.Name('ak'),
					bk = new JS.Name('bk'),
					l = new JS.Name('l'),
					i = new JS.Name('i'),
					tr = new JS.Name('true'),
					fa = new JS.Name('false'),
					len = new JS.Name('length');
			return new JS.Fn('_eq', [a, b], [
				new JS.If([
					new JS.BinOp('!=', new JS.Prefix('typeof ', a), new JS.Prefix('typeof ', b)),
						new JS.Prefix('return ', fa),
					new JS.BinOp('==', a, new JS.Name('null')),
						new JS.Prefix('return ', new JS.BinOp('==', b, new JS.Name('null'))),
					new JS.BinOp('&&', new JS.FnCall('Array.isArray', [a]), new JS.FnCall('Array.isArray', [b])), new JS.Array([
						new JS.If([new JS.BinOp('!=', new JS.Prop(a, len), new JS.Prop(b, len)), new JS.Prefix('return ', fa)]),
						new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0'), l, new JS.Prop(a, len)])),
										new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
							new JS.If([
								new JS.UnOp('!', new JS.FnCall('_eq', [new JS.Index(a, i), new JS.Index(b, i)])),
									new JS.Prefix('return ', fa)
							])
						])),
						new JS.Prefix('return ', tr)
					]),
					new JS.BinOp('==', new JS.Prefix('typeof ', a), new JS.String('object', "'")), new JS.Array([
						new JS.Prefix('var ', new JS.Assigment([ak, new JS.FnCall('Object.keys', [a]), bk, new JS.FnCall('Object.keys', [b])])),
						new JS.If([new JS.BinOp('!=', new JS.Prop(ak, len), new JS.Prop(bk, len)), new JS.Prefix('return ', fa)]),
						new JS.For(new JS.Prefix('var ', new JS.Assigment([i, new JS.Number('0'), l, new JS.Prop(ak, len)])),
										new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.Array([
							new JS.If([
								new JS.UnOp('!', new JS.FnCall('_eq', [new JS.Index(a, new JS.Index(ak, i)), new JS.Index(b, new JS.Index(ak, i))])),
									new JS.Prefix('return ', fa)
							])
						])),
						new JS.Prefix('return ', tr)
					]),
					new JS.Prefix('return ', new JS.BinOp('===', a, b))
				])
			], true);
		})(),
		'_id': new JS.ExprFn('_id', [new JS.Name('x')], new JS.Name('x'), true),
		'_count': (function() {
			var f = new JS.Name('f'),
					a = new JS.Name('a'),
					i = new JS.Name('i'),
					n = new JS.Name('n'),
					l = new JS.Name('l'),
					zero = new JS.Number('0');
			return new JS.Fn('_count', [f, a], [
				new JS.For(new JS.Prefix('var ', new JS.Assigment([i, zero, n, zero, l, new JS.Prop(a, new JS.Name('length'))])),
					new JS.BinOp('<', i, l), new JS.Suffix('++', i), new JS.If([new JS.FnCall(f, [new JS.Index(a, i)]), new JS.Suffix('++', n)])),
				new JS.Prefix('return ', n)
			], true);
		})(),
		'_powf': (function() {
			var f = new JS.Name('f'),
					a = new JS.Name('a'),
					i = new JS.Name('i'),
					n = new JS.Name('n'),
					p = new JS.Name('p'),
					zero = new JS.Number('0');
			return new JS.Fn('_powf', [f, n, a], [
				new JS.If([
					new JS.BinOp('<', n, zero),
						new JS.For(new JS.Prefix('var ', p), new JS.BinOp('!==', p, a), new JS.Empty(), new JS.Assigment([a, new JS.FnCall(f, [a])])),
					new JS.For(new JS.Prefix('var ', new JS.Assigment([i, zero])), new JS.BinOp('<', i, n), new JS.Suffix('++', i),
						new JS.Assigment([a, new JS.FnCall(f, [a])]))
				]),
				new JS.Prefix('return ', a)
			], true);
		})(),
		'_vals': new JS.ExprFn('_vals', [new JS.Name('o')],
			new JS.MethodCall(new JS.FnCall('Object.keys', [new JS.Name('o')]), 'map', [new JS.ExprFn('', [new JS.Name('k')],
				new JS.Index(new JS.Name('o'), new JS.Name('k'))
			)])
		, true),
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
		'@rangef': ['_rangef'],
		'@last': ['_last'],
		'@rev': ['_rev'],
		'@sort': ['_sort'],
		'@sortl': ['_sortl'],
		'@sortf': ['_sortf'],
		'@part': ['_part'],
		'@zip': ['_zip'],
		'@uniq': ['_uniq'],
		'@cart': ['_cart'],
		'@flat': ['_flat'],
		'@wrap': ['_wrap'],
		'@sum': ['_sum'],
		'@mem': ['_mem'],
		'@prod': ['_prod'],
		'@rep': ['_rep'],
		'@sq': ['_sq'],
		'@zipm': ['_zipm'],
		'@mapm': ['_mapm'],
		'@cartm': ['_cartm'],
		'@table': ['_table'],
		'@fac': ['_fac'],
		'@maxl': ['_maxl'],
		'@minl': ['_minl'],
		'@maxf': ['_maxf'],
		'@minf': ['_minf'],
		'@`': ['_mod', '_index'],
		'@eq': ['_eq'],
		'@neq': ['_eq', '_neq'],
		'@id': ['_id'],
		'@count': ['_count'],
		'!^': ['_powf'],
	};
	var opToLib = {
		'@%': '_mod',
		'@range': '_range',
		'@rangef': '_rangef',
		'@last': '_last',
		'@rev': '_rev',
		'@sort': '_sort',
		'@sortl': '_sortl',
		'@sortf': '_sortf',
		'@part': '_part',
		'@zip': '_zip',
		'@uniq': '_uniq',
		'@cart': '_cart',
		'@flat': '_flat',
		'@wrap': '_wrap',
		'@sum': '_sum',
		'@mem': '_mem',
		'@prod': '_prod',
		'@rep': '_rep',
		'@sq': '_sq',
		'@zipm': '_zipm',
		'@mapm': '_mapm',
		'@cartm': '_cartm',
		'@table': '_table',
		'@fac': '_fac',
		'@maxl': '_maxl',
		'@minl': '_minl',
		'@maxf': '_maxf',
		'@minf': '_minf',
		'@`': '_index',
		'@eq': '_eq',
		'@neq': '_neq',
		'@id': '_id',
		'@count': '_count',
		'!^': '_powf',
		'@vals': '_vals',
	};

	function wrap(a) {return a instanceof JS.Array? a.val: [a]};
	function all(a, f) {for(var i = 0, l = a.length; i < l; i++) if(!f(a[i])) return false; return true};
	// Operators
	var operators = {
		'@id': function(x) {return new JS.FnCall('_id', [x])},
		// Math
		// unary
		'@+': function(x) {return new JS.UnOp('+', x)},
		'@-': function(x) {return new JS.UnOp('-', x)},
		'@sq': function(x) {return new JS.FnCall('_sq', [x])},
		'@sqrt': function(x) {return new JS.FnCall('Math.sqrt', [x])},
		'@abs': function(x) {return new JS.FnCall('Math.abs', [x])},
		'@fac': function(x) {return new JS.FnCall('_fac', [x])},
		'@maxl': function(x) {return new JS.FnCall('_maxl', [x])},
		'@minl': function(x) {return new JS.FnCall('_minl', [x])},
		// binary
		'+': function(x, y) {return new JS.BinOp('+', x, y)},
		'@in': function(x, y) {return new JS.BinOp(' in ', x, y)},
		'-': function(x, y) {return new JS.BinOp('-', x, y)},
		'*': function(x, y) {return new JS.BinOp('*', x, y)},
		'/': function(x, y) {return new JS.BinOp('/', x, y)},
		'%': function(x, y) {return new JS.BinOp('%', x, y)},
		'%%': function(x, y) {return new JS.BinOp('==', new JS.BinOp('%', x, y), new JS.Number(0))},
		'@%': function(x, y) {return new JS.FnCall('_mod', [x, y])},
		'@^': function(x, y) {return new JS.FnCall('Math.pow', [x, y])},
		'@max': function(x, y) {return new JS.FnCall('Math.max', [x, y])},
		'@min': function(x, y) {return new JS.FnCall('Math.min', [x, y])},
		'@maxf': function(f, x) {return new JS.FnCall('_maxf', [f, x])},
		'@minf': function(f, x) {return new JS.FnCall('_minf', [f, x])},
		'@count': function(f, x) {return new JS.FnCall('_count', [f, x])},

		// Boolean
		// unary
		'@not': function(x) {return new JS.UnOp('!', x)},
		'@or': function(x) {return new JS.BinOpL('||', x.val)},
		'@and': function(x) {return new JS.BinOpL('&&', x.val)},
		// binary
		'=': function(x, y) {return new JS.BinOp('==', x, y)},
		'!=': function(x, y) {return new JS.BinOp('!=', x, y)},
		'==': function(x, y) {return new JS.BinOp('===', x, y)},
		'!==': function(x, y) {return new JS.BinOp('!==', x, y)},
		'>': function(x, y) {return new JS.BinOp('>', x, y)},
		'>=': function(x, y) {return new JS.BinOp('>=', x, y)},
		'<': function(x, y) {return new JS.BinOp('<', x, y)},
		'<=': function(x, y) {return new JS.BinOp('<=', x, y)},
		'@eq': function(a, b) {return new JS.FnCall('_eq', [a, b])},
		'@neq': function(a, b) {return new JS.FnCall('_neq', [a, b])},

		'||': function(x, y) {return new JS.BinOp('||', x, y)},
		'&&': function(x, y) {return new JS.BinOp('&&', x, y)},

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
			} else if(l instanceof JS.Group) {
				return new JS.FnCall(new JS.ExprFn('', [],
					[new JS.Prefix('var ', new JS.Assigment([new JS.Name('_r'), new JS.Array([])]))]
						.concat(l.val).concat(new JS.Name('_r'))), []);
			}
		},
		// binary
		'&': function(args, body) {
			if(args instanceof JS.Object)
				return new JS.ExprFn(args.val[0].val, args.val.slice(1), wrap(body));
			return new JS.ExprFn('', wrap(args), wrap(body));
		},
		':&': function(o) {
			return operators['&'](o.args[0], o);
		},
		'@&': function(args, body) {
			if(args instanceof JS.Object)
				return new JS.Fn(args.val[0].val, args.val.slice(1), wrap(body));
			return new JS.Fn('', wrap(args), wrap(body));
		},
		'!': function(fn, args) {return new JS.FnCall(fn, [args])},
		'@!': function(fn, list) {
			if(list instanceof JS.Array)
				return new JS.FnCall(fn, list.val);
			else return new JS.MethodCall(fn, 'apply', [new JS.Name('null'), list]);
		},
		'\\': function(bl, arg) {
			if(arg instanceof JS.Array) {
				var vars = arg.val.filter(function(x) {return x instanceof JS.Name && x.val == '.'}).map(randVar);
				var n = 0;
				var args = arg.val.map(function(x) {return x instanceof JS.Name && x.val == '.'? vars[n++]: x});
				if(bl instanceof JS.Block) {
					if(args.length != operators[bl.val].length)
						throw 'Invalid length for partial application of '+bl.val+'.';
					return new JS.ExprFn('', vars, operators[bl.val].apply(null, args));
				} else return new JS.ExprFn('', vars, new JS.FnCall(bl, args));
			} else {
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
			}
		},
		'\\\\': function(f) {
			return new JS.ExprFn('', [new JS.Name('x')], operators['\\'](f, new JS.Name('x')));
		},
		// ternary
		'!!': function(fn, x, y) {return new JS.FnCall(fn, [x, y])},
		'`!': function(m, args, a) {return new JS.FnCall(new JS.Index(a, m), wrap(args))},

		// String
		// unary
		'@fromCode': function(n) {return new JS.FnCall('String.fromCharCode', [n])},
		// binary
		'@r': function(s, m) {return new JS.RegExp(s, m)},
		'@join': function(n, a) {return new JS.MethodCall(a, 'join', [n])},
		'@test': function(n, a) {return new JS.MethodCall(n, 'test', [a])},
		'@match': function(n, a) {return new JS.MethodCall(a, 'match', [n])},
		'@codeAt': function(n, a) {return new JS.MethodCall(a, 'charCodeAt', [n])},
		'@indexOf': function(n, a) {return new JS.MethodCall(a, 'indexOf', [n])},
		'@split': function(n, a) {return new JS.MethodCall(a, 'split', [n])},
		'@lastIndexOf': function(n, a) {return new JS.MethodCall(a, 'lastIndexOf', [n])},
		// ternary
		'@replace': function(a, b, s) {return new JS.MethodCall(a, 'replace', [a, b])},

		// Array
		// unary
		'#': function(n) {return new JS.Prop(n, new JS.Name('length'))},
		'@head': function(n) {return new JS.Index(n, new JS.Number('0'))},
		'@tail': function(n) {return new JS.MethodCall(n, 'slice', [new JS.Number('1')])},
		'@init': function(n) {return new JS.MethodCall(n, 'slice', [new JS.Number('0'), new JS.UnOp('-', new JS.Number('1'))])},
		'@last': function(n) {return new JS.FnCall('_last', [n])},
		'@rev': function(n) {return new JS.FnCall('_rev', [n])},
		'@sort': function(n) {return new JS.FnCall('_sort', [n])},
		'@sortl': function(n) {return new JS.FnCall('_sortl', [n])},
		'@sortf': function(f, n) {return new JS.FnCall('_sortf', [f, n])},
		'@keys': function(o) {return new JS.FnCall('Object.keys', [o])},
		'@vals': function(o) {return new JS.FnCall('_vals', [o])},

		'@uniq': function(n) {return new JS.FnCall('_uniq', [n])},
		'@mem': function(f) {return new JS.FnCall('_mem', [f])},
		'@flat': function(n) {return new JS.FnCall('_flat', [n])},
		'@wrap': function(n) {return new JS.FnCall('_wrap', [n])},
		'&,': function(n) {return new JS.Array([n])},
		'@sum': function(n) {return new JS.FnCall('_sum', [n])},
		'@prod': function(n) {return new JS.FnCall('_prod', [n])},
		'@zipm': function(n) {return new JS.FnCall('_zipm', [n])},
		'@cartm': function(n) {return new JS.FnCall('_cartm', [n])},

		'@til': function(n) {
			return new JS.FnCall('_range', [new JS.Array([new JS.Number('0'), new JS.BinOp('-', n, new JS.Number('1'))])]);
		},
		'@to': function(n) {
			return new JS.FnCall('_range', [new JS.Array([new JS.Number('1'), n])]);
		},
		'@range': function(o) {return new JS.FnCall('_range', [o])},
		'@rangef': function(a, b, c) {return new JS.FnCall('_rangef', [a, b, c])},
		// binary
		'@zip': function(a, b) {return new JS.FnCall('_zip', [a, b])},
		'@mapm': function(f, a) {return new JS.FnCall('_mapm', [f, a])},
		'@join': function(n, a) {return new JS.MethodCall(a, 'join', [n])},
		'@cart': function(a, b) {return new JS.FnCall('_cart', [a, b])},
		'@part': function(n, a) {return new JS.FnCall('_part', [n, a])},
		'@rep': function(n, v) {return new JS.FnCall('_rep', [n, v])},
		'@each': function(fn, a) {return new JS.MethodCall(a, 'forEach', [fn])},
		',': function(a, b) {return new JS.MethodCall(a instanceof JS.String || a instanceof JS.Number? new JS.Array([a]): a, 'concat', [b])},
		'@,': function(a, b) {return new JS.Array([a, b])},
		'!*': function(fn, a) {return new JS.MethodCall(a, 'map', [fn])},
		'!/': function(fn, a) {return new JS.MethodCall(a, 'reduce', [fn])},
		'!-': function(fn, a) {return new JS.MethodCall(a, 'filter', [fn])},
		'!^': function(f, n, a) {return new JS.FnCall('_powf', [f, n, a])},
		'`': function(i, a) {return new JS.Index(a, i)},
		'@`': function(i, a) {return new JS.FnCall('_index', [i, a])},
		// ternary
		'@fold': function(fn, v, a) {return new JS.MethodCall(a, 'reduce', [fn, v])},
		'@table': function(f, a, b) {return new JS.FnCall('_table', [f, a, b])},

		// JS Keywords
		'@break': function() {return new JS.Prefix('break', new JS.Empty())},
		// unary
		'@return': function(x) {return new JS.Prefix('return ', x)},
		'@>': function(x) {return new JS.FnCall('_r.push', [x])},
		'@typeof': function(x) {return new JS.Prefix('typeof ', x)},
		'?': function(o) {return new JS.Ternary(o.val)},
		'@iff': function(o) {return new JS.If(o.val)},
		'@:': function(o) {return new JS.Assigment(o.val)},
		'@vars': function(o) {
			if(o instanceof JS.Object) return new JS.Prefix('var ', new JS.Assigment(o.val));
			if(o instanceof JS.Array) return new JS.Prefix('var ', new JS.CommaList(o.val));
		},
		'@super': function(args) {return new JS.FnCall('_super.call', [new JS.Name('this')].concat(wrap(args)))},
		// binary
		'@if': function(c, b) {return new JS.If([c, b])},
		':': function(k, v) {return new JS.Assigment([k, v])},
		':!': function(o, n, v) {return new JS.Assigment([n, operators[o.val](n, v)])},
		'@let': function(o) {
			return new JS.FnCall(new JS.ExprFn('', [],
				[new JS.Prefix('var ', new JS.Assigment(o.val.slice(0, -1)))].concat(wrap(o.val[o.val.length-1]))
			), []);
		},
		'@var': function(k, v) {return new JS.Prefix('var ', new JS.Assigment([k, v]))},
		'@new': function(x, a) {return new JS.Prefix('new ', new JS.FnCall(x, wrap(a)))},
		'@instanceof': function(x, y) {return new JS.BinOp(' instanceof ', x, y)},
		'@while': function(c, a) {return new JS.While(c, a)},
		'@?': function(x, o) {
			var name = x instanceof JS.Name? x: randVar();
			for(var i = 0, a = o.val, l = a.length, r = []; i < l; i += 2) {
				var k = a[i], v = a[i+1];
				if(v !== undefined) r.push(new JS.BinOp('==', name, k), v);
				else r.push(k);
			}
			if(x instanceof JS.Name)
				return new JS.Ternary(r);
			else
				return new JS.FnCall(new JS.Fn('', [], [new JS.Prefix('var ', new JS.Assigment([name, x])), new JS.Prefix('return ', new JS.Ternary(r))]), []);
		},
		'|': function(o, ch) {
			var ar = ch.val, c = o;
			for(var i = 0, l = ar.length; i < l; i += 2) {
				var a = ar[i], b = ar[i+1];
				if(b instanceof JS.Array) {
					var ba = b.val;
					if(a instanceof JS.Name) {
						if(a.val[0] == '.') c = new	JS.MethodCall(c, new JS.Name(a.val.slice(1)), ba);
						else c = new JS.FnCall(a, [c].concat(ba));
					} else c = new JS.FnCall(new JS.Index(c, a), ba);
				} else {
					c = a instanceof JS.Name && a.val[0] == '.'? new JS.Prop(c, new JS.Name(a.val.slice(1))): new JS.Index(c, a);
					i--;
				}
			}
			return c;
		},
		'@|': function(o, ch) {
			var ar = ch.val;
			for(var i = 0, l = ar.length, r = []; i < l; i += 2) {
				var a = ar[i], b = ar[i+1], c = o;
				if(b instanceof JS.Array) {
					var ba = b.val;
					if(a instanceof JS.Name) {
						if(a.val[0] == '.') c = new	JS.MethodCall(c, new JS.Name(a.val.slice(1)), ba);
						else c = new JS.FnCall(a, [c].concat(ba));
					} else c = new JS.FnCall(new JS.Index(c, a), ba);
				} else if(a instanceof JS.Block && a.val == ':') {
					var args = a.args;
					if(args[0] instanceof JS.Name && args[0].val[0] == '.')
						args[0] = new JS.Prop(c, new JS.Name(args[0].val.slice(1)));
					c = a;
					i--
				} else {
					c = a instanceof JS.Name && a.val[0] == '.'? new JS.Prop(c, new JS.Name(a.val.slice(1))):
							a instanceof JS.Block? a: new JS.Index(c, a);
					i--;
				}
				r.push(c);
			}
			return new JS.SemiGroup(r);
		},
		// other
		'@fori': function(a, b, c, body) {
			return new JS.For(a, b, c, body);
		},
		'@for': function(arg, type, val, body) {
			var type = ''+type.val, body = wrap(body);
			if(type == 'of') {
				var arg = wrap(arg);
				var nameI = arg.length == 2? arg[0]: randVar();
				var nameV = arg.length == 2? arg[1]: arg[0];
				var nameL = randVar();
				var nameC = randVar(); 
				return new JS.For(
					new JS.Prefix('var ', new JS.Assigment([
						nameI, new JS.Number('0'),
						nameC, val,
						nameL, new JS.Prop(nameC, new JS.Name('length'))
					])),
					new JS.BinOp('<', nameI, nameL),
					new JS.Suffix('++', nameI),
					new JS.Array([new JS.Prefix('var ', new JS.Assigment([
						nameV, new JS.Index(nameC, nameI)
					]))].concat(body))
				);
			} else if(type == 'of2') {
				var arg = wrap(arg);
				var nameV = arg.length <= 2? arg[0]: arg[2];
				var nameC2 = arg.length == 2? arg[1]: arg.length > 3? arg[3]: randVar();
				var nameX = arg.length >= 3? arg[0]: randVar();
				var nameY = arg.length >= 3? arg[1]: randVar();
				var nameL1 = randVar();
				var nameL2 = randVar();
				var nameC = randVar(); 
				return new JS.For(
					new JS.Prefix('var ', new JS.Assigment([
						nameY, new JS.Number('0'),
						nameC, val,
						nameL1, new JS.Prop(nameC, new JS.Name('length'))
					])),
					new JS.BinOp('<', nameY, nameL1),
					new JS.Suffix('++', nameY),
					new JS.Array([
						new JS.For(
							new JS.Prefix('var ', new JS.Assigment([
								nameX, new JS.Number('0'),
								nameC2, new JS.Index(nameC, nameY),
								nameL2, new JS.Prop(nameC2, new JS.Name('length'))
							])),
							new JS.BinOp('<', nameX, nameL2),
							new JS.Suffix('++', nameX),
							new JS.Array([
								new JS.Prefix('var ', new JS.Assigment([nameV, new JS.Index(nameC2, nameX)]))
							].concat(body))
						)
					])
				);
			} else if(type == 'in') {
				var arg = wrap(arg);
				if(arg.length == 1)
					return new JS.ForIn(
						new JS.Prefix('var ', arg[0]),
						val,
						new JS.Array(body)
					);
				else if(arg.length == 2)
					return new JS.ForIn(
						new JS.Prefix('var ', arg[0]),
						val,
						new JS.Array([new JS.Prefix('var ', new JS.Assigment([arg[1], new JS.Index(val, arg[0])]))].concat(body))
					);
			} else if(type == 'own') {
				var arg = wrap(arg);
				if(arg.length == 1)
					return new JS.ForIn(
						new JS.Prefix('var ', arg[0]),
						val,
						new JS.Array([new JS.If([
							new JS.FnCall(new JS.Prop(val, new JS.Name('hasOwnProperty')), [arg[0]]), new JS.Array(body)
						])])
					);
				else if(arg.length == 2)
					return new JS.ForIn(
						new JS.Prefix('var ', arg[0]),
						val,
						new JS.Array([new JS.If([
							new JS.FnCall(new JS.Prop(val, new JS.Name('hasOwnProperty')), [arg[0]]),
							new JS.Array([new JS.Prefix('var ', new JS.Assigment([arg[1], new JS.Index(val, arg[0])]))].concat(body))
						])])
					);
			}
		},
		'@class': function(name, args, body) {
			var args = args instanceof JS.Array || args instanceof JS.Group? args.val: [args];
			var paren = args[0];
			var body = body instanceof JS.Array? [body]: body instanceof JS.Object? body.val: [body];
			var constr = body.length % 2? body[0]: new JS.Fn(name.val, [], [], true);
			body = body.length % 2? body.slice(1): body;
			// make constructor from array
			if(constr instanceof JS.Array) constr = new JS.Fn(name.val, constr.val, 
				constr.val.map(function(x) {
					return new JS.Assigment([new JS.Prop(new JS.Name('this'), x), x])
				}), true);
			else constr = new JS.Prefix('var ', new JS.Assigment([name, constr]));
			var r = [constr];
			if(paren) {
				addLib('_extends');
				r.push(new JS.FnCall('_extends', [name, new JS.Name('_super')]));
			}
			// methods
			for(var i = 0, l = body.length; i < l; i += 2) {
				var k = body[i], v = body[i+1];
				if(k instanceof JS.Name)
					r.push(new JS.Assigment([
						new JS.Prop(new JS.Prop(name, new JS.Name('prototype')), k), v
					]));
				else
					r.push(new JS.Assigment([
						new JS.Index(new JS.Prop(name, new JS.Name('prototype')), k), v
					]));
			}
			// close it up
			r.push(new JS.Prefix('return ', name));
			return new JS.Prefix('var ',
				new JS.Assigment([name, new JS.FnCall(
					new JS.Fn('', paren? [new JS.Name('_super')]: [], r), paren? [paren]: [])]));
		},
	
		// Wortel
		// unary
		'~': function(n) {
			if(n instanceof JS.Array)
				return new JS.FnCall(new JS.ExprFn('', [], n.val), []);
			return compilePointerExpr(n.val, null, true);
		},
		'#~': function(n) {return compileMathFnRPN(n.val, null, true)},
		'^': function(bl) {
			if(bl instanceof JS.Block && bl.quoted) {
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
		'%^': function(bl) {
			var id = randVar();
			if(bl instanceof JS.Block && bl.quoted) {
				checkLib(bl.val);
				for(var i = 0, n = operators[bl.val].length, args = []; i < n; i++) args.push(id);
				return new JS.ExprFn('', [id], operators[bl.val].apply(null, args));
			} else {
				return new JS.ExprFn('', [id], new JS.FnCall(bl, [id, id]));
			}
		},
		// binary
		'!#~': function(n, a) {
			if(a instanceof JS.Number || a instanceof JS.Name)
				return compileMathFnRPN(n.val, [a]);
			return new JS.FnCall(compileMathFnRPN(n.val, null, true), [a]);
		},
		'!~': function(n, a) {
			if(a instanceof JS.Number || a instanceof JS.Name)
				return compilePointerExpr(n.val, [a]);
			return new JS.FnCall(compilePointerExpr(n.val, null, true), [a]);
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
			var t = args[1];
			if(f) {
				var fs = require('fs');
				fs.readFile(f, 'ascii', function(e, s) {
					if(e) console.log('Error: ', e);
					else if(t == '--run' || t == '-r')
						eval(Wortel.compile(s));
					else console.log(Wortel.compile(s));
				});
			}
		}
	}
}
