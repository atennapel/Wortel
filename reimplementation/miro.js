/* miro compiler
 * @version: 0.1
 * @author: Albert ten Napel
 * @email: aptennap@gmail.com
 * @github: atennapel
 * @date: 2014-07-13
 *
 * compile steps (compile)
 * 1. parse and tokenize (tokenize)
 * 2. tokens -> miro ast (toAST)
 * 3. get args for operators (getArgs)
 * 4. optimize miro ast (optimizeAST)
 * 5. miro ast -> js ast (compileAST)
 * 6. optimize js ast (optimizeJS)
 * 7. compile js ast (compileJS)
 */
var Miro = (function() {
	var version = '0.1';
	var tab = '\t';

	var SHOW_POS = false;
	var DEBUG = false;

	var gvars = [];
	var libs = {};
	var opt = {};

	// util
	function merge(a, b) {for(var k in a) b[k] = a[k]; return b};
	function wrap(x) {return Array.isArray(x)? x: [x]};
	function formatValue(x) {
		var t = typeof x;
		if(x === undefined) return 'undefined';
		else if(x === null) return 'null';
		else if(t == 'number' || x instanceof Number
						|| t == 'boolean' || x instanceof Boolean
						|| t == 'function' || x instanceof Function)
			return ''+x;
		else if(t == 'string' || x instanceof String)
			return JSON.stringify(x);
		else if(Array.isArray(x))
			return '[' + x.map(formatValue).join(' ') + ']';
		else {
			var className = (x.constructor && x.constructor.name.trim());
			var r = [];
			for(var k in x)
				if(x.hasOwnProperty(k))
					r.push(formatValue(k), formatValue(x[k]));
			return (!className || className == 'Object'? '': className) + '{' + r.join(' ') + '}';
		}
	}
	function all(f, a) {
		for(var i = 0, l = a.length; i < l; i++)
			if(!f(a[i])) return false;
		return true;
	}
	function flatten(a) {
		for(var i = 0, l = a.length, r = []; i < l; i++)
			for(var j = 0, k = a[i].length; j < k; j++)
				r.push(a[i][j]);
		return r;
	}
	function pushAll(a, r) {
		for(var i = 0, l = r.length; i < l; i++)
			a.push(r[i]);
		return a;
	}
	Array.prototype.toString = function(x) {return 'Array[' + this.join(', ') + ']'};

	// Error handler
	function log(x, s) {if(DEBUG) console.log(s? ''+x: x); return x}
	function logger(f) {
		return function() {
			log(Array.prototype.slice.call(arguments).join(' '));
			var t = f.apply(this, arguments);
			log(t, true);
			return t;
		}
	};
	function error(msg) {
		throw msg;
	}

	// Tokenizer
	var BRACKETS = '()[]{}';
	var REVERSING_OPERATOR = '~';
	var NAME_OPERATOR = '@';

	function isDigit(c) {return /[0-9]/.test(c)}
	function isIdent(c) {return /[a-z_\$\.]/i.test(c)}
	function isOpeningBracket(c) {var t = BRACKETS.indexOf(c); return t != -1 && !(t % 2)}
	function isClosingBracket(c) {var t = BRACKETS.indexOf(c); return t != -1 && t % 2}
	function otherBracket(c) {var t = BRACKETS.indexOf(c); return t == -1? false: BRACKETS[t + (t % 2? -1: 1)]};
	function isBracket(c) {return isOpeningBracket(c) || isClosingBracket(c)}
	function isWhitespace(c) {return /\s/.test(c)}

	function Pos(start, end) {this.start = start; this.end = end};
	Pos.prototype.toString = function() {return '' + this.start.line + ':' + this.start.ch + '-' + this.end.line + ':' + this.end.ch};
	function pos(ch, line) {var start = {ch: ch, line: line}; return function(ch, line) {return new Pos(start, {ch: ch, line: line})}}
	var emptyPos = pos('?', '?')('?', '?');

	function tokenize(s) {
		var START = 0, NAME = 1, NUMBER = 2, OPERATOR = 3, DSTRING = 4, QSTRING = 5, BSTRING = 6, COMMENT = 7, BCOMMENT = 8, NAMEOPERATOR = 9;
		var state = START, line = 1, t = [], esc = false, first = false, br = null, lv = 0, curpos, w;
		for(var i = 0, j = 1, l = s.length, r = []; i <= l; i++, j++) {
			var c = s[i] || '\n';
			if(state == START) {
				if(c == '"') state = DSTRING, curpos = pos(j, line);
				else if(c == "'") w = isWhitespace(s[i-1] || ''), first = true, state = QSTRING, curpos = pos(j, line);
				else if(isOpeningBracket(c)) r.push({type: 'openbracket', val: c, pos: pos(j, line)(j, line)});
				else if(isClosingBracket(c)) r.push({type: 'closebracket', val: c, pos: pos(j, line)(j, line)});
				else if(isIdent(c)) state = NAME, t.push(c), curpos = pos(j, line);
				else if(isDigit(c)) state = NUMBER, t.push(c), curpos = pos(j, line);
				else if(c == ';' && s[i+1] == ';') i++, first = true, state = COMMENT;
				else if(!isWhitespace(c)) state = OPERATOR, t.push(c), curpos = pos(j, line);
			} else if(state == NAME) {
				if(!isIdent(c) && !isDigit(c))
					r.push({type: 'name', val: t.join(''), pos: curpos(j-1, line)}), t = [], i--, j--, state = START;
				else t.push(c);
			} else if(state == NUMBER) {
				if(!isIdent(c) && !isDigit(c))
					r.push({type: 'number', val: t.join(''), pos: curpos(j-1, line)}), t = [], i--, j--, state = START;
				else t.push(c);
			} else if(state == OPERATOR) {
				if(isIdent(c)) {
					if(s[i-1] == NAME_OPERATOR) {
						if(t.length > 1)
							r.push({type: 'symbol', val: t.slice(0, -1).join(''), pos: curpos(j-1, line)});
						state = NAMEOPERATOR, t = [NAME_OPERATOR, c];
					} else r.push({type: 'symbol', val: t.join(''), pos: curpos(j-1, line)}), t = [], i--, j--, state = START;
				} else if(isWhitespace(c) || isBracket(c) || isDigit(c) || c == '"' || c == "'" || (c == ';' && s[i+1] == ';'))
					r.push({type: 'symbol', val: t.join(''), pos: curpos(j-1, line)}), t = [], i--, j--, state = START;
				else t.push(c);
			} else if(state == NAMEOPERATOR) {
				if(!isIdent(c) && !isDigit(c))
					r.push({type: 'symbol', name: true, val: t.join(''), pos: curpos(j-1, line)}), t = [], i--, j--, state = START;
				else t.push(c);
			} else if(state == DSTRING) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') t.push(c), esc = true;
				else if(c == '\n') t.push('\\n');
				else if(c == '\r') t.push('\\r');
				else if(c != '"') t.push(c);
				else r.push({type: 'string', val: t.join(''), pos: curpos(j, line)}), t = [], state = START;
			} else if(state == QSTRING) {
				if(first) {
					first = false;
					if(isOpeningBracket(c)) br = c, lv = 1, state = BSTRING;
					else if(!w && r[r.length-1].type != 'metadata') r.push({type: 'metadata'}), i--, state = START;
					else if(isWhitespace(c)) r.push({type: 'string', val: '', pos: curpos(j, line)}), state = START;
					else t.push(c);
				} else if(!isWhitespace(c)) t.push(c);
				else r.push({type: 'string', val: t.join(''), pos: curpos(j, line)}), t = [], state = START;
			} else if(state == BSTRING) {
				if(c == br) lv++, t.push(c);
				else if(c == otherBracket(br)) {
					lv--;
					if(lv == 0) r.push({type: 'string', val: t.join(''), pos: curpos(j, line)}), br = null, t = [], state = START;
					else t.push(c);
				} else t.push(c);
			} else if(state == COMMENT) {
				if(first) {
					first = false;
					if(isOpeningBracket(c)) br = c, lv = 1, state = BCOMMENT;
					else if(c == '\n') state = START;
					else t.push(c);
				} else if(c == '\n') parseComment(t.join('')), t = [], state = START;
				else t.push(c);
			} else if(state == BCOMMENT) {
				if(c == br) t.push(c), lv++;
				else if(c == otherBracket(br)) {
					lv--;
					if(lv == 0) parseComment(t.join('')), t = [], state = START;
					else t.push(c);
				}
			}
			if(s[i] == '\n') line++, j = 0;
		}
		if(lv > 0) {
			if(state == BSTRING)
				error('Unclosed quoted bracket ' + br + ' at ' + line + ':' + (i+1));
			else if(state == BCOMMENT)
				error('Unclosed comment bracket ' + br + ' at ' + line + ':' + (i+1));
			else
				error('Unclosed bracket ' + br + ' at ' + line + ':' + (i+1));
		}
		return r;
	}

	function parseComment(comment) {
		if(comment[0] == '!') {
			var c = comment.trim();
		}
	}
	
	// toAST
	function toAST(a, e) {
		// split operators, create expr tree (without operators)
		for(var i = 0, l = a.length, r = [], tr = [], lv = 0, cb, ob, cp; i < l; i++) {
			var c = a[i], t = c.type, v = c.val, p = c.pos;
			if(!cb) {
				if(t == 'number') r.push(new expr.Number(v, p));
				else if(t == 'name') r.push(new expr.Name(v, p));
				else if(t == 'string') r.push(new expr.String(v, p));
				else if(t == 'metadata') r.push(expr.meta);
				else if(t == 'symbol') pushAll(r, (new expr.Symbol(v, p, c.name)).split(e));
				else if(t == 'openbracket') cb = v, ob = otherBracket(v), cp = p, lv = 1;
				else if(t == 'closebracket')
					error('Closing bracket before opening ' + v + ' at ' + p.start.line + ':' + p.start.ch);
			} else {
				if(t == 'openbracket' && cb == v) tr.push(c), lv++;
				else if(t == 'closebracket' && ob == v) {
					lv--;
					if(lv == 0) {
						var ttr = toAST(tr, e), ps = pos(cp.start.ch, cp.start.line)(p.start.ch, p.start.line);
						if(cb == '(') r.push(new expr.Group(ttr, ps));
						else if(cb == '[') r.push(new expr.Array(ttr, ps));
						else if(cb == '{') r.push(new expr.Object(ttr, ps));
						else error('Unknown bracket type ' + cb + ' at ' + p.start.line + ':' + p.start.ch);
						tr = [], cb = ob = cp = null;
					} else tr.push(c);
				} else tr.push(c);
			}
		}
		if(lv > 0)
			error('Unclosed bracket ' + cb + ' at ' + cp.start.line + ':' + cp.start.ch);
		return r;
	}

	function getArgs(r, e) {
		// handle quoting and reversing
		for(var i = r.length-2; i >= 0; i--) {
			var c = r[i], next = r[i+1];
			if(c instanceof expr.Symbol) {
				if(c.val == REVERSING_OPERATOR && next instanceof expr.Symbol) {
					next.reverse();
					r.splice(i, 1);
				} else {
					var op = getOp(c, e), nextop = getOp(next, e, true);
					if(
						(op.quoter && next instanceof expr.Symbol && !nextop.quoter && !nextop.unquotable) ||
						(op.groupquoter && next instanceof expr.Group) ||
						(op.arrayquoter && next instanceof expr.Array) ||
						(op.objectquoter && next instanceof expr.Object)
					) next.quote(op);
				}
			} else if(c === expr.meta) next.quote(true) 
		}

		//console.log('getArgs', r);
		// create operators and handle meta
		for(var i = r.length-1, s = [], meta = null; i >= 0; i--) {
			var c = r[i];
			//console.log(i, c +'', '['+s.join(' ')+']', meta+'')
			if(meta) c.setMeta(meta), meta = null, c.getArgs(s, e);
			else if(c === expr.meta) meta = s.pop();
			else c.getArgs(s, e);
		}

		//console.log('result', s);

		return s.reverse();
	}

	function hashArray(a) {
		return a.map(function(x) {return x.hash()}).join(' ');
	}

	function optimizeArray(a, e) {
		return a.map(function(x) {return x.optimize(e)});
	}

	function optimizeAST(a, e) {
		var i = 1;
		//console.log('optimize #' + (i++) + ': ' + (a+''));
		var h = null, c = optimizeArray(a, e), t = hashArray(c);
		while(t !== h) {
			//console.log('optimize #' + (i++) + ': ' + (c + ''));
			h = hashArray(c), c = optimizeArray(c, e), t = hashArray(c);
		}
		return c;
	}

	function compileAll(a, e) {return a.map(function(x) {return x.compile(e)})}

	function compileAST(a, e) {
		return compileAll(a, e).join(';');
	}

	function compile(s, iopt) {
		merge(iopt || {}, opt);
		var e = opt.env || Object.create(stdlib);
		var tokens = tokenize(s);
		var past = toAST(tokens, e);
		var ast = getArgs(past, e);
		var oast = optimizeAST(ast, e);
		var cast = compileAST(oast, e);
		return cast;
	}

	function compileNumber(s, p) {
		var str = s.replace(/\$|\_/g, '');
		if(/^0x[0-9a-f]+$/i.test(str)) return +str;
		else if(/^0b[01]+$/i.test(str)) return +parseInt(str.slice(2), 2);
		else if(/^0o[0-7]+$/i.test(str)) return +parseInt(str.slice(2), 8);
		else if(/^[0-9]+x[0-9]+$/.test(str)) {
			var f = str.match(/^[0-9]+x/)[0];
			return +parseInt(str.slice(f.length), +f.slice(0, -1));
		}
		else if(/^[0-9]*\.[0-9]+$|^[0-9]+$/.test(str)) return +str;
		else error('Invalid number ' + s + ' at ' + (this.pos || emptyPos));
	}

	// exprs
	var expr = {};

	function countAllSimpleNames(a, o) {
		var o = o || {};
		a.forEach(function(x) {x.countSimpleNames(o)});
		return o;
	}

	function ExprFactory(pos, env) {this.pos = pos || emptyPos; this.env = env};
	var $$ = ExprFactory;
	ExprFactory.prototype.setPos = function(pos) {this.pos = pos; return this};
	ExprFactory.prototype.setEnv = function(env) {this.env = env; return this};
	ExprFactory.from = function(t, e) {
		return new ExprFactory(
			t.pos || this.pos || emptyPos,
			e || t.env || this.env || null
		);
	};
	
	ExprFactory.prototype.convert = function(x) {
		if(typeof x == 'string') return this.name(x);
		if(typeof x == 'number') return this.number('' + x);
		if(Array.isArray(x)) return this.array(x);
		if(x instanceof expr.Expr) return x;
		error('Cannot convert ' + x);
	};
	ExprFactory.prototype.convertAll = function(a) {
		return a.map((function(x) {return this.convert(x)}).bind(this));
	};
	ExprFactory.arrayUnpack = function(a) {
		return ExprFactory.isArray(a)? a.val: [a];
	};

	ExprFactory.prototype.number = function(n) {return new expr.Number(n, this.pos)};
	ExprFactory.prototype.string = function(s) {return new expr.String(s, this.pos)};
	ExprFactory.prototype.name = function(n) {return new expr.Name(n, this.pos)};
	ExprFactory.prototype.symbol = function(s, name) {return new expr.Symbol(s, this.pos, name)};
	ExprFactory.prototype.group = function(v) {return new expr.Group(this.convertAll(v), this.pos)};
	ExprFactory.prototype.array = function(v) {return new expr.Array(this.convertAll(v), this.pos)};
	ExprFactory.prototype.object = function(v) {return new expr.Object(this.convertAll(v), this.pos)};
	ExprFactory.prototype.operator = function(op, v) {return new expr.Operator(this.convert(op), this.convertAll(v), this.pos, this.env)};
	ExprFactory.prototype.partialApplication = function(fn, args) {return new expr.PartialApplication(this.convert(fn), this.convertAll(args), this.pos)};
	ExprFactory.prototype.operatorFunction = function(op) {return new expr.OperatorFunction(this.convert(op), this.pos)};
	ExprFactory.prototype.call = function(fn, args) {return new expr.Call(this.convert(fn), this.convertAll(args), this.pos)};
	ExprFactory.prototype.fn = function(args, body, name) {return new expr.Fn(this.convertAll(args), this.convert(body), this.pos, name)};
	ExprFactory.prototype.fork = function(a, l) {return new expr.Fork(this.convertAll(a), l, this.pos)};
	ExprFactory.prototype.composition = function(a) {return new expr.Composition(this.convertAll(a), this.pos)};
	ExprFactory.prototype.index = function(a, i) {return new expr.Index(this.convert(a), this.convert(i), this.pos)};
	ExprFactory.prototype.prop = function(a, i) {return new expr.Prop(this.convert(a), this.convert(i), this.pos)};
	ExprFactory.prototype.method = function(a, i, args) {return new expr.Call(new expr.Prop(this.convert(a), this.convert(i), this.pos), this.convertAll(args), this.pos)};
	ExprFactory.prototype.unOp = function(op, v) {return new expr.UnOp(op, this.convert(v), this.pos)};
	ExprFactory.prototype.binOp = function(op, v, v2) {return new expr.BinOp(op, this.convert(v), this.convert(v2), this.pos)};
	var $ = new ExprFactory();

	expr.Meta = function() {};
	expr.Meta.prototype.toString = function() {return "'"};
	expr.Meta.prototype.quote = function() {};
	expr.meta = new expr.Meta();
	
	expr.Expr = function(v, pos) {this.val = v; this.pos = pos || emptyPos};
	expr.Expr.prototype.toString = function() {return this.val};
	expr.Expr.prototype.quote = function() {return this};
	expr.Expr.prototype.setMeta = function(meta) {this.meta = meta; return this};
	expr.Expr.prototype.getArgs = function(s) {s.push(this)};
	expr.Expr.prototype.hash = function() {return this.toString()};
	expr.Expr.prototype.optimize = function() {return this};
	expr.Expr.prototype.isDot = function() {return false};
	expr.Expr.prototype.replace = function(o) {return this};
	expr.Expr.prototype.countSimpleNames = function(o) {
		var o = o || {};
		return o;
	};
	function replaceAll(a, o) {return a.map(function(x) {return x.replace(o)})}
	
	expr.Number = function(v, pos) {expr.Expr.call(this, ''+v, pos)};
	ExprFactory.isNumber = function(x) {return x instanceof expr.Number};
	expr.Number.prototype = new expr.Expr();
	expr.Number.prototype.compile = function() {return compileNumber(this.val, this.pos)};

	expr.String = function(v, pos) {expr.Expr.call(this, v, pos)};
	ExprFactory.isString = function(x) {return x instanceof expr.String};
	expr.String.prototype = new expr.Expr();
	expr.String.prototype.toString = function() {return JSON.stringify(this.val)};
	expr.String.prototype.compile = function() {return '"' + this.val + '"'};

	var uname = (function() {var n = 0; return function() {return new expr.Name('_' + (n++))}})();
	expr.Name = function(v, pos) {expr.Expr.call(this, v, pos)};
	ExprFactory.isName = function(x) {return x instanceof expr.Name};
	expr.Name.prototype = new expr.Expr();
	expr.Name.prototype.isDot = function() {return this.val == '.'};
	expr.Name.prototype.replace = function(o) {return this.val in o? o[this.val]: this};
	expr.Name.prototype.isFunction = function() {return !this.isDot() && this.val[0] == '.'};
	expr.Name.prototype.functionless = function() {return new expr.Name(this.val.slice(1), this.pos)};
	expr.Name.prototype.isSimpleName = function() {return this.val.indexOf('.') == -1};
	expr.Name.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		if(this.isFunction()) {
			var arg = uname();
			return $.fn([arg], $.prop(arg, this.functionless()));
		}
		return this;
	};
	expr.Name.prototype.compile = function(e) {
		if(this.val == '.') error('Cannot compile dot.');
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
		return ''+t;
	};
	expr.Name.prototype.compileNoFn = function(e) {return this.functionless().compile(e)};
	expr.Name.prototype.countSimpleNames = function(o) {
		var o = o || {};
		if(this.isSimpleName()) o[this.val] = (o[this.val] || 0) + 1; 
		return o;
	};
	var dot = new expr.Name('.');
	function hasDot(a) {for(var i = 0, l = a.length; i < l; i++) if(a[i].isDot()) return true; return false};

	expr.Symbol = function(v, pos, name) {
		expr.Expr.call(this, v, pos);
		this.name = name || false;
	};
	ExprFactory.isSymbol = function(x) {return x instanceof expr.Symbol};
	expr.Symbol.prototype = new expr.Expr();
	expr.Symbol.prototype.quote = function() {this.quoted = true; return this};
	expr.Symbol.prototype.reverse = function() {this.reversed = true; return this};
	expr.Symbol.prototype.split = function(e) {
		if(this.name || this.val.length == 1) {getOp(this, e); return [this]}
		for(var i = 0, l = this.val.length; i < l; i++) {
			var c = this.val.slice(i);
			if(e[c]) {
				var r = [];
				if(i > 0) {
					var op = this.val.slice(0, i), tp = pos(this.pos.start.ch, this.pos.end.line)(this.pos.end.ch+i, this.pos.end.line);
					if(op.length == 1 && !e[op]) error('Unknown operator ' + op + ' at ' + tp);
					pushAll(r, (new expr.Symbol(op, tp)).split(e));
				}
				r.push(new expr.Symbol(c, pos(this.pos.start.ch+i, this.pos.start.line)(this.pos.end.ch, this.pos.end.line)));
				return r;
			}
		}
		error('Unknown operator ' + this.val + ' at ' + this.pos);
	};
	expr.Symbol.prototype.getArgs = function(s, e) {
		var op = getOp(this, e);
		if(op.unquotable || !this.quoted) {
			for(var i = 0, l = Math.min(op.length, s.length), args = []; i < l; i++)
				args.push(s.pop());
			s.push(new expr.Operator(this, args, this.pos, e));
		} else s.push(this);
	};
	expr.Symbol.prototype.compile = function() {error('Cannot compile symbol')};
	
	expr.List = function(v, pos) {expr.Expr.call(this, v || [], pos)};
	expr.List.prototype = new expr.Expr();
	expr.List.prototype.toString = function() {return '(' + this.val.join(' ') + ')'};
	expr.List.prototype.quote = function(r) {
		this.quoted = true;
		for(var i = 0, l = this.val.length; i < l; i++) {
			var c = this.val[i];
			if(c instanceof expr.Group) {if(r.recgroupquoter) c.quote(r)}
			else if(c instanceof expr.Array) {if(r.recarrayquoter) c.quote(r)}
			else if(c instanceof expr.Object) {if(r.recobjectquoter) c.quote(r)}
			else c.quote(r);
		}
		return this;
	};
	expr.List.prototype.getArgs = function(s, e) {
		this.val = getArgs(this.val, e);
		s.push(this);
	};
	expr.List.prototype.optimize = function(e) {
		for(var i = 0, a = this.val, l = a.length; i < l; i++)
			a[i] = a[i].optimize(e);
		return this;
	};
	expr.List.prototype.countSimpleNames = function(o) {
		var o = o || {};
		for(var i = 0, l = this.val.length; i < l; i++)
			this.val[i].countSimpleNames(o);
		return o;
	};
	expr.List.prototype.replace = function(o) {
		this.val = replaceAll(this.val, o);
		return this;
	};

	expr.Group = function(v, pos) {expr.List.call(this, v, pos)};
	ExprFactory.isGroup = function(x) {return x instanceof expr.Group};
	expr.Group.prototype = new expr.List();
	expr.Group.prototype.toString = function() {return '(' + this.val.join(' ') + ')'};
	expr.Group.prototype.compile = function(e) {return '(' + compileAll(this.val, e).join(', ') + ')'};
	expr.Group.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		expr.List.prototype.optimize.call(this, e);
		var l = this.val.length, f = this.val[0];
		if(l == 0) return $.name('null');
		if(l == 1 && (
			f instanceof expr.PartialApplication ||
			f instanceof expr.Group ||
			f instanceof expr.Array ||
			f instanceof expr.BinOp ||
			f instanceof expr.Symbol ||
			f instanceof expr.Operator ||
			f instanceof expr.OperatorFunction ||
			f instanceof expr.Composition ||
			f instanceof expr.Fork)) return f;
		return this;
	};

	expr.Array = function(v, pos) {expr.List.call(this, v, pos)};
	ExprFactory.isArray = function(x) {return x instanceof expr.Array};
	expr.Array.prototype = new expr.List();
	expr.Array.prototype.toString = function() {return '[' + this.val.join(' ') + ']'};
	expr.Array.prototype.compile = function(e) {return '[' + compileAll(this.val, e).join(', ') + ']'};

	expr.Object = function(v, pos) {expr.List.call(this, v, pos)};
	ExprFactory.isObject = function(x) {return x instanceof expr.Object};
	expr.Object.prototype = new expr.List();
	expr.Object.prototype.toString = function() {return '{' + this.val.join(' ') + '}'};
	expr.Object.prototype.compile = function(e) {
		for(var i = 0, a = this.val, l = 2*(0|a.length/2), r = []; i < l; i += 2) {
			var k = a[i].compile(e), v = a[i+1].compile(e);
			r.push(k + ': ' + v);
		}
		return '{' + r.join(', ') + '}';
	};

	expr.Operator = function(op, v, pos, env) {
		if(!env) error('No enviroment provided for operator ' + op + ' at ' + pos);
		expr.List.call(this, wrap(v), pos);
		this.op = op;
		this.env = env;
		this.opt = op.opt || getOp(this.op, this.env);
	};
	ExprFactory.isOperator = function(x) {return x instanceof expr.Operator};
	expr.Operator.prototype = new expr.List();
	expr.Operator.prototype.toString = function() {return this.op + '[' + this.val.join(' ') + ']'};
	expr.Operator.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		expr.List.prototype.optimize.call(this, e);
		var oval = [].concat(this.val), al = oval.length, ol = this.opt.length;

		if(this.op.meta && $$.isName(this.op.meta)) {
			var v = this.op.meta.val, o = this;
			if($$.isOperator(o)) o.op.meta = null;
			for(var i = 0, l = v.length; i < l; i++)
				if(suffix[v[i]]) o = suffix[v[i]](o);
			return o;
		}

		if(this.opt.optfn) {
			var args = [], b = false;
			for(var i = 0, v = this.val, l = v.length; i < l; i++) {
				var c = v[i];
				if(this.opt.optfn[i]) {
					if(c instanceof expr.PartialApplication) {
						b = true;
						var n = c.countDots(e), targs = [];
						for(var j = 0; j < n; j++) targs.push(uname());
						v[i] = $.call(c, targs);
						pushAll(args, targs);
					} else if(c instanceof expr.Fn) {
						b = true;
						var n = c.args.length, targs = [];
						for(var j = 0; j < n; j++) targs.push(uname());
						v[i] = $.call(c, targs);
						pushAll(args, targs);
					} else if(c instanceof expr.Fork) {
						b = true;
						var n = c.length, targs = [];
						for(var j = 0; j < n; j++) targs.push(uname());
						v[i] = $.call(c, targs);
						pushAll(args, targs);
					} else if(c instanceof expr.Composition) {
						b = true;
						var n = c.length == -1? 1: c.length, targs = [];
						for(var j = 0; j < n; j++) targs.push(uname());
						v[i] = $.call(c, targs);
						pushAll(args, targs);
					} else if(c instanceof expr.OperatorFunction) {
						b = true;
						var n = getOp(c.val, e).length, targs = [];
						for(var j = 0; j < n; j++) targs.push(uname());
						v[i] = $.operator(c.val, targs);
						pushAll(args, targs);
					} else if(c.isDot()) {
						b = true;
						var n = uname();
						v[i] = n;
						args.push(n);
					}
				}
			}
			if(b) return $.fn(args, this);
		}

		if(al == 0 && ol > 0)
			return $.operatorFunction(this.op);
		if(al == ol) {
			if(!this.opt.fn) error('Operator ' + this.op + ' does not have a compilation function.');
			return this.opt.fn.apply(this, this.op.reversed? [].concat(oval).reverse(): oval);
		}
		if(al < ol)
			return $.partialApplication(this.op, oval);
		if(al > ol)
			error('Too many arguments for operator ' + this.op + ' at ' + this.pos);
		return this;
	};
	expr.Operator.prototype.compile = function(e) {error('Cannot compile an operator')};
	
	expr.PartialApplication = function(fn, args, pos) {
		expr.List.call(this, args, pos);
		this.fn = fn;
	};
	expr.PartialApplication.prototype = new expr.List();
	expr.PartialApplication.prototype.toString = function() {return 'PartialApplication(' + this.fn + '[' + this.val.join(' ') + '])'};
	expr.PartialApplication.prototype.countDots = function(e) {
		if(this.fn instanceof expr.Symbol && e) {
			var op = getOp(this.fn, e);
			for(var i = 0; this.val.length < op.length; i++)
				this.val.push(dot);
		}
		for(var i = 0, n = 0, l = this.val.length; i < l; i++)
			if(this.val[i].isDot()) n++; 
		return n;
	};
	expr.PartialApplication.prototype.applyArgs = function(a, r) {
		for(var i = j = 0, v = this.val, l = v.length; i < l; i++)
			if(v[i].isDot()) v[i] = a[j++] || new expr.Name('undefined');

		if(r) return a.slice(j);
		else {
			pushAll(v, a.slice(j));
			return [];
		}
	};
	expr.PartialApplication.prototype.countSimpleNames = function(o) {
		var o = o || {};
		expr.List.prototype.countSimpleNames.call(this, o);
		this.fn.countSimpleNames(o);
		return o;
	};
	expr.PartialApplication.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		this.fn = this.fn.optimize(e);
		expr.List.prototype.optimize.call(this, e);
		
		var lh = (this.fn.meta && this.fn.meta instanceof expr.Number && !isNaN(+this.fn.meta.val) && this.fn.meta.val) || -1;
		
		if(this.fn instanceof expr.PartialApplication) {
			var t = this.fn;
			this.fn = t.fn;
			this.val = t.val.concat(this.val);
		} else if(this.fn instanceof expr.Symbol) {
			var op = getOp(this.fn, e);
			var args = [].concat(this.val);
			var fnargs = [];
			for(var i = 0; args.length < op.length; i++)
				args.push(dot);
			for(var i = 0, l = args.length; i < l; i++) {
				var c = args[i];
				if(c.isDot()) {
					var t = uname();
					args[i] = t;
					fnargs.push(t);
				}
			}
			return $.fn(fnargs, $.operator(this.fn, args));
		} else {
			var args = [].concat(this.val);
			var fnargs = [];
			var mtd = this.fn instanceof expr.Name && this.fn.isFunction();
			if(mtd) fnargs.push(uname());
			for(var i = 0, l = args.length; i < l; i++) {
				var c = args[i];
				if(c.isDot()) {
					var t = uname();
					args[i] = t;
					fnargs.push(t);
				}
			}
			for(;args.length < lh;) {
				var t = uname();
				args.push(t);
				fnargs.push(t);
			}
			return lh == -1? $.fn(
				fnargs,
				$.method(
					mtd? $.index(fnargs[0], this.fn): this.fn,
					'apply',
					[
						mtd? fnargs[0]: 'this',
						$.method(
							args,
							'concat',
							[
								$.call('Array.prototype.slice.call', ['arguments', fnargs.length])
							]
						)
					]
				)
			): $.fn(fnargs, $.call(mtd? $.index(fnargs[0], this.fn): this.fn, args));
		}
		return this;
	};
	expr.PartialApplication.prototype.compile = function(e) {error('Cannot compile a partial application')};

	expr.OperatorFunction = function(op, pos) {expr.Expr.call(this, op, pos)};
	expr.OperatorFunction.prototype = new expr.Expr();
	expr.OperatorFunction.prototype.toString = function() {return 'OperatorFunction(' + this.val + ')'};
	expr.OperatorFunction.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		var op = getOp(this.val, e);
		for(var i = 0, l = op.length, args = []; i < l; i++) args.push(uname());
		return $.fn(args, $.operator(this.val, args));
	};
	expr.OperatorFunction.prototype.compile = function() {error('Cannot compile an operator function')};

	expr.Call = function(fn, args, pos) {expr.List.call(this, wrap(args), pos); this.fn = fn};
	ExprFactory.isCall = function(x) {return x instanceof expr.Call};
	expr.Call.prototype = new expr.List();
	expr.Call.prototype.toString = function() {return 'Call(' + this.fn + '[' + this.val.join(' ') + '])'};
	expr.Call.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		this.fn = this.fn.optimize(e);
		expr.List.prototype.optimize.call(this, e);
		if(this.fn instanceof expr.OperatorFunction) {
			var al = this.val.length, ol = getOp(this.fn.val, e).length; 	
			if(al == ol) return $.operator(this.fn.val, this.val);
			if(al < ol) return $.partialApplication(this.fn.val, this.val);
			if(al > ol) error('Too many arguments for ' + this.fn + ' at ' + this.pos);
		} else if(this.fn instanceof expr.PartialApplication) {
			this.val = this.fn.applyArgs(this.val, true);
			if(this.fn.fn instanceof expr.Symbol)
				return $.operator(this.fn.fn, this.fn.val.concat(this.val));
			return this;
		} else if(this.fn instanceof expr.Symbol) {
			return $.operator(this.fn, this.val);
		} else if(this.fn instanceof expr.Fn && this.fn.args.length > 0 && this.fn.body.length == 1) {
			for(var i = 0, l = this.fn.args.length, o = {}; i < l; i++)
				o[this.fn.args[i].val] = this.val[i];
			if(all(function(x) {return x instanceof expr.Name && x.isSimpleName()}, this.val)) {
				return this.fn.body[0].replace(o);
			} else {
				for(var i = 0, oa = 0, sn = this.fn.countSimpleNames(); i < l; i++)
					if((sn[this.fn.args[i].val] || 0) > 1) return this;
				return this.fn.body[0].replace(o);
			}
		} else if(this.val[0] instanceof expr.Name && this.fn instanceof expr.Name && this.fn.isFunction()) {
			return $.Name(this.val[0] + this.fn.val);
		} else if(this.fn instanceof expr.Number ||
							this.fn instanceof expr.Array ||
							this.fn instanceof expr.Group ||
							this.fn instanceof expr.Object)
			return this.fn;
		return this;
	};
	expr.Call.prototype.compile = function(e) {
		return (
			$$.isObject(this.fn) || $$.isFn(this.fn)?
				'(' + this.fn.compile(e) + ')':
				this.fn.compile(e)
		) + '(' + compileAll(this.val, e).join(', ') + ')';
	};
	expr.Call.prototype.replace = function(o) {
		this.fn = this.fn.replace(o);
		this.val = replaceAll(this.val, o);
		return this;
	};
	expr.Call.prototype.countSimpleNames = function(o) {
		var o = o || {};
		expr.List.prototype.countSimpleNames.call(this, o);
		this.fn.countSimpleNames(o);
		return o;
	};

	expr.Fn = function(args, body, pos, name) {this.args = wrap(args); this.body = $$.arrayUnpack(body); this.pos = pos; this.name = name || ''};
	ExprFactory.isFn = function(x) {return x instanceof expr.Fn};
	expr.Fn.prototype = new expr.Expr();
	expr.Fn.prototype.toString = function() {return 'Fn(' + this.name + '[' + this.args.join(' ') + '] [' + this.body.join(' ') + '])'};
	expr.Fn.prototype.replace = function(o) {this.body = replaceAll(this.body, o); return this};
	expr.Fn.prototype.optimize = function(e) {
		this.body = this.body.map(function(x) {return x.optimize(e)});
		return this;
	};
	expr.Fn.prototype.compile = function(e) {
		var b = compileAll(this.body, e), f = b.slice(0, -1), last = b[b.length-1], l = b.length;
		return (
			l == 0?
				'function ' + this.name + '(' + compileAll(this.args, e).join(', ') + ') {}':
			l == 1?
				'function ' + this.name + '(' + compileAll(this.args, e).join(', ') + ') {return ' +  last + '}':
				'function ' + this.name + '(' + compileAll(this.args, e).join(', ') + ') {' + f.join('; ') + '; return ' + last + '}'
		);
	};
	expr.Fn.prototype.countSimpleNames = function(o) {return countAllSimpleNames(this.body, o)};

	expr.Fork = function(a, l, pos) {
		expr.List.call(this, a, pos);
		this.length = l;

		for(var i = 0, v = this.val, l = v.length; i < l; i++) {
			var c = v[i];
			if(c instanceof expr.Object && c.quoted)
				v[i] = new expr.Fork(c.val, this.length, this.pos);
			else if(c instanceof expr.Array && c.quoted)
				v[i] = new expr.Composition(c.val, this.pos);
		}
	};
	expr.Fork.prototype = new expr.List();
	expr.Fork.prototype.toString = function() {return 'Fork' + this.length + '(' + this.val.join(' ') + ')'};
	expr.Fork.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		var a = this.val, l = this.val.length;

		for(var i = 0; i < l; i++)
			if(this.val[i] instanceof expr.Composition)
				this.val[i].length = this.length;
		expr.List.prototype.optimize.call(this, e);

		if(this.length == 1) {
			var x = uname(), r;
			if(l == 0) {
				r = x;
			} else if(l == 1) {
				r = $.call(a[0], [x, x]);
			} else if(l == 2) {
				// hook, (a b) -> x.a(x, b(x))
				r = $.call(a[0], [x, $.call(a[1], [x])]);
			} else {
				// fork, (a b c) -> x.b(a(x), c(x))
				r = $.call(a[0], [x]);
				for(var i = 1; i < l; i += 2)
					r = $.call(a[i], [r, $.call(a[i+1], [x])]);
			}
			return $.fn([x], r);
		} else if(this.length == 2) {
			var x = uname(), y = uname(), r;
			if(l == 2) {
				// hook, (a b) -> x.a(x, b(x))
				r = $.call(a[0], [x, $.call(a[1], [y])]);
			} else if(l > 2) {
				// fork, (a b c) -> x.b(a(x), c(x))
				r = $.call(a[0], [x, y]);
				for(var i = 1; i < l; i += 2)
					r = $.call(a[i], [r, $.call(a[i+1], [x, y])]);
			} else error('Need atleast two arguments for a double-fork');
			return $.fn([x, y], r);
		} else error('Invalid fork length ' + this.length + ' at ' + this.pos);

		return this;
	};
	expr.Fork.prototype.compile = function() {error('Cannot compile an fork')};

	expr.Composition = function(a, pos) {
		expr.List.call(this, a, pos);
		this.length = -1;

		for(var i = 0, v = this.val, l = v.length; i < l; i++) {
			var c = v[i];
			if(c instanceof expr.Object && c.quoted)
				v[i] = new expr.Fork(c.val, this.length == -1? 1: this.length, this.pos);
			else if(c instanceof expr.Array && c.quoted)
				v[i] = new expr.Composition(c.val, this.pos);
		}
	};
	expr.Composition.prototype = new expr.List();
	expr.Composition.prototype.toString = function() {return 'Composition(' + this.val.join(' ') + ')'};
	expr.Composition.prototype.optimize = function(e) {
		var $ = $$.from(this, e);
		for(var i = 0, l = this.val.length, r = []; i < l; i++) {
			var c = this.val[i];
			if(c instanceof expr.Composition)
				pushAll(r, c.val);
			else r.push(c);
		}
		this.val = r;

		expr.List.prototype.optimize.call(this, e);
		
		var a = this.val, args = [];
		
		var targ = uname();
		if(a.length == 0) return $.fn([targ], targ);

		var first = a[0];
		if(first instanceof expr.Number ||
			 first instanceof expr.Array || 
			 first instanceof expr.Object) 
			return $.fn([], first);
	
		var last = a[a.length-1], c;
		if(last.meta instanceof expr.Number && !isNaN(+last.meta.val))
			this.length = +last.meta.val;
		if(last instanceof expr.Symbol) {
			var op = getOp(last, e);
			for(var i = 0, ll = op.length; i < ll; i++) args.push(uname());
			c = $.operator(last, args);
		} else if(last instanceof expr.PartialApplication) {
			var f = last.fn, pargs = last.val;
			if(f instanceof expr.Symbol) {
				var op = getOp(f, e), opl = op.length;
				for(var i = 0, ll = opl - pargs.length; i < ll; i++) args.push(uname());
				c = $.operator(f, pargs.concat(args));
			} else if(f instanceof expr.Name && f.isFunction()) {
				args.push(uname());
				c = $.call(last, [args[0]]);
			} else c = $.method(f, 'apply', ['this', $.method(pargs, 'concat', ['arguments'])]);
		} else if(last instanceof expr.Name && last.isFunction()) {
			args.push(uname());
			c = $.index(args[0], last);
		} else if(last instanceof expr.Fork) {
			for(var i = 0, al = last.length; i < al; i++)
				args.push(uname());
			c = $.call(last, args);
		} else if(last instanceof expr.Fn && last.args.length > 0) {
			for(var i = 0, al = last.args.length; i < al; i++)
				args.push(uname());
			c = $.call(last, args);
		} else {
			if(this.length == -1)
				c = $.method(last, 'apply', ['this', 'arguments']);
			else {
				for(;args.length < this.length;) args.push(uname());
				c = $.call(last, args);
			}
		}

		for(var i = a.length - 2; i >= 0; i--)
			c = $.call(a[i], [c]);
		return $.fn(args, c);
	};
	expr.Composition.prototype.compile = function() {error('Cannot compile an composition')};

	expr.Index = function(a, i, pos) {expr.Expr.call(this, i, pos); this.a = a};
	expr.Index.prototype = new expr.Expr();
	expr.Index.prototype.toString = function() {return 'Index(' + this.a + ' ' + this.val + ')'};
	expr.Index.prototype.replace = function(o) {
		this.val = this.val.replace(o);
		this.a = this.a.replace(o);
		return this;
	};
	expr.Index.prototype.optimize = function(e) {
		this.val = this.val.optimize(e);
		this.a = this.a.optimize(e);
		return this;
	};
	expr.Index.prototype.compile = function(e) {
		return this.a.compile(e) + '[' + this.val.compile(e) + ']';
	};
	expr.Index.prototype.countSimpleNames = function(o) {
		var o = o || {};
		this.val.countSimpleNames(o);
		this.a.countSimpleNames(o);
		return o;
	};

	expr.Prop = function(a, i, pos) {expr.Expr.call(this, i, pos); this.a = a};
	expr.Prop.prototype = new expr.Expr();
	expr.Prop.prototype.toString = function() {return 'Prop(' + this.a + ' ' + this.val + ')'};
	expr.Prop.prototype.replace = function(o) {
		this.val = this.val.replace(o);
		this.a = this.a.replace(o);
		return this;
	};
	expr.Prop.prototype.optimize = function(e) {
		this.val = this.val.optimize(e);
		this.a = this.a.optimize(e);
		return this;
	};
	expr.Prop.prototype.compile = function(e) {
		return (
			(
				$$.isArray(this.a) || $$.isGroup(this.a) || $$.isName(this.a) || $$.isCall(this.a)?
					this.a.compile(e):
					'(' + this.a.compile(e) + ')'
			) + '.' + this.val.compile(e)
		);
	};
	expr.Prop.prototype.countSimpleNames = function(o) {
		var o = o || {};
		this.val.countSimpleNames(o);
		this.a.countSimpleNames(o);
		return o;
	};

	expr.UnOp = function(op, v, pos) {expr.Expr.call(this, v, pos); this.op = op};
	expr.UnOp.prototype = new expr.Expr();
	expr.UnOp.prototype.toString = function() {return 'UnOp(' + this.op + ' ' + this.val + ')'};
	expr.UnOp.prototype.compile = function(e) {return this.op + '(' + this.val.compile(e) + ')'};
	expr.UnOp.prototype.replace = function(o) {
		this.val = this.val.replace(o);
		return this;
	};

	expr.BinOp = function(op, v, v2, pos) {expr.Expr.call(this, v, pos); this.op = op; this.val2 = v2};
	expr.BinOp.prototype = new expr.Expr();
	expr.BinOp.prototype.toString = function() {return 'BinOp(' + this.op + ' ' + this.val + ' ' + this.val2 + ')'};
	expr.BinOp.prototype.compile = function(e) {return '(' + this.val.compile(e) + ' ' + this.op + ' ' + this.val2.compile(e) + ')'};
	expr.BinOp.prototype.replace = function(o) {
		this.val = this.val.replace(o);
		this.val2 = this.val2.replace(o);
		return this;
	};
	expr.BinOp.prototype.optimize = function(e) {
		this.val = this.val.optimize(e);
		this.val2 = this.val2.optimize(e);
		return this;
	};
	expr.BinOp.prototype.countSimpleNames = function(o) {
		var o = o || {};
		this.val.countSimpleNames(o);
		this.val2.countSimpleNames(o);
		return o;
	};

	// stdlib
	function getOp(v, e, noerr) {
		if(!e) error('No enviroment provided for getOp');
		var v = v instanceof expr.Symbol? v.val: v, t = e[v];
		if(!noerr && !t) error('Unknown operator ' + v);
		return t || null;
	}
	function callOp(t, op, ar) {
		return t.env[op].fn.apply(t, ar);
	}
	var stdlib = {};

	// Math
	stdlib['@+'] = {
		length: 1,
		optfn: [true],
		fn: function(x) {return $$.from(this).unOp('+', x)}
	};
	stdlib['@-'] = {
		length: 1,
		optfn: [true],
		fn: function(x) {return $$.from(this).unOp('-', x)}
	};

	stdlib['+'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('+', x, y)}
	};
	stdlib['-'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('-', x, y)}
	};
	stdlib['*'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('*', x, y)}
	};
	stdlib['/'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('/', x, y)}
	};
	stdlib['%'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('%', x, y)}
	};
	stdlib['**'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).call('Math.pow', [x, y])}
	};

	// Comparison
	stdlib['='] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('==', x, y)}
	};
	stdlib['!='] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('!=', x, y)}
	};
	stdlib['=='] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('===', x, y)}
	};
	stdlib['!=='] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('!==', x, y)}
	};
	stdlib['>'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('>', x, y)}
	};
	stdlib['>='] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('>=', x, y)}
	};
	stdlib['<'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('<', x, y)}
	};
	stdlib['<='] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('<=', x, y)}
	};
	stdlib['&&'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('&&', x, y)}
	};
	stdlib['||'] = {
		length: 2,
		optfn: [true, true],
		fn: function(x, y) {return $$.from(this).binOp('||', x, y)}
	};

	// Function
	stdlib['&'] = {length: 2, unquotable: true, fn: function(a, b) {return $$.from(this).fn($$.arrayUnpack(a), b)}};
	stdlib['&^'] = {length: 1, unquotable: true, fn: function(x) {return $$.from(this).fn([], x)}};
	stdlib['\\'] = {
		length: 2,
		quoter: true, unquotable: true,
		fn: function(f, a) {return $$.from(this).partialApplication(f, [a])}
	};
	stdlib['@\\'] = {
		length: 2,
		quoter: true, unquotable: true,
		fn: function(f, a) {return $$.from(this).partialApplication(f, [dot, a])}
	};
	stdlib['&\\'] = {
		length: 2,
		quoter: true, unquotable: true,
		fn: function(f, a) {return $$.from(this).partialApplication(f, $$.arrayUnpack(a))}
	};
	stdlib['\\\\'] = {
		length: 1,
		quoter: true, unquotable: true,
		fn: function(f) {
			var n = uname();
			return $$.from(this).fn([n], $.partialApplication(f, [n]));
		}
	};

	// Calling
	stdlib['!'] = {length: 2, fn: function(f, a) {return $$.from(this).call(f, [a])}};
	stdlib['!!'] = {length: 3, fn: function(f, a, b) {return $$.from(this).call(f, [a, b])}};
	stdlib['@!'] = {length: 2, fn: function(f, a) {
		var $ = $$.from(this);
		if($.isArray(a))
			return $.call(f, a.val);
		return $.method(f, 'apply', ['this', a]);
	}};
	stdlib['`!'] = {length: 3, fn: function(m, a, o) {
		var $ = $$.from(this);
		return (
			$$.isFn(m)?
				$.call($.call(m, [o]), $$.arrayUnpack(a)):
				$.call($.index(o, m), $$.arrayUnpack(a))
		);
	}}
	
	// Assignment
	stdlib[':'] = {length: 2, fn: function(n, v) {return $$.from(this).binOp('=', n, v)}};

	// Array
	stdlib['#'] = {
		length: 1,
		optfn: [true],
		fn: function(x) {return $$.from(this).prop(x, 'length')}
	};
	stdlib['@#'] = {
		length: 2,
		optfn: [false, true],
		fn: function(f, a) {
			var $ = $$.from(this);
			var f = f;
			
			if($$.isNumber(f) || $$.isString(f)) {
				var n = uname();
				f = $.fn([n], $.binOp('===', n, f));
			}

			return $.prop($.method(a, 'filter', [f]), 'length');
		}
	};
	stdlib['@til'] = {
		length: 1,
		optfn: [true],
		fn: function(n) {
			var $ = $$.from(this);
			return $.method($.call('Array.apply', [0, $.call('Array', [n])]), 'map', [$.fn([], $.index('arguments', 1))]);
		}
	};
	stdlib['@to'] = {
		length: 1,
		optfn: [true],
		fn: function(n) {
			var $ = $$.from(this);
			return $.method($.call('Array.apply', [0, $.call('Array', [n])]), 'map', [$.fn([], $.binOp('+', 1, $.index('arguments', 1)))]);
		}
	};
	stdlib['@range'] = {
		length: 2,
		optfn: [true, true],
		fn: function(a, b) {
			var $ = $$.from(this);
			return $.method($.call('Array.apply', [0, $.call('Array', [$.binOp('-', b, a)])]), 'map', [$.fn([], $.binOp('+', a, $.index('arguments', 1)))]);
		}
	};
	stdlib['@rev'] = {
		length: 1,
		optfn: [true],
		fn: function(a) {
			var $ = $$.from(this);
			return $.method($.method($.array([]), 'concat', [a]), 'reverse', []);
		}
	};
	stdlib['`'] = {
		length: 2,
		optfn: [true, true],
		fn: function(i, a) {
			var $ = $$.from(this);
			return $.index(a, i)
		}
	};
	stdlib['&`'] = {
		length: 2,
		optfn: [true, true],
		fn: function(i, a) {
			var $ = $$.from(this);
			return $.prop(a, i)
		}
	};
	stdlib['!*'] = {
		length: 2,
		optfn: [false, true],
		fn: function(f, a) {return $$.from(this).method(a, 'map', [f])}
	};
	stdlib['!-'] = {
		length: 2,
		optfn: [false, true],
		fn: function(f, a) {return $$.from(this).method(a, 'filter', [f])}
	};
	stdlib['!/'] = {
		length: 2,
		optfn: [false, true],
		fn: function(f, a) {return $$.from(this).method(a, 'reduce', [f])}
	};

	stdlib['@sum'] = {
		length: 1,
		optfn: [true],
		fn: function(o) {
			var $ = $$.from(o), a = uname(), b = uname();
			return $.method(o, 'reduce', [$.fn([a, b], $.binOp('+', a, b)), 0]);
		}
	};
	stdlib['@prod'] = {
		length: 1,
		optfn: [true],
		fn: function(o) {
			var $ = $$.from(o), a = uname(), b = uname();
			return $.method(o, 'reduce', [$.fn([a, b], $.binOp('*', a, b)), 1]);
		}
	};

	// Tacit
	stdlib['~'] = {
		length: 1, quoter: true, unquotable: true, fn: function(x) {
			if($$.isName(x)) return $.prop('this', x);
			return this;
		}
	};
	stdlib['^'] = {length: 1, quoter: true, unquotable: true, fn: function(x) {
		var $ = $$.from(this);
		if($$.isName(x) || $$.isNumber(x))
			return callOp(this, '@to', [x]);
		else if($$.isOperator(x))
			return $.operatorFunction(x);
		else if($$.isGroup(x)) {
			var a = x.val;
			if(a.length == 0) error('Empty group for ^');
			if(a.length == 1) return callOp(this, '@to', a);
			if(a.length == 2) return callOp(this, '@range', a);
			if(a.length > 2) { 
				error('Unimplemented');
				return callOp(this, '@range', a);
			}
		}
		else error('Invalid type for ^ with argument ' + x);
	}};
	stdlib['@'] = {
		length: 1,
		unquotable: true,
		objectquoter: true,
		arrayquoter: true,
		recarrayquoter: true,
		recobjectquoter: true,
		fn: function(x) {
			var $ = $$.from(this);
			var meta = this.op.meta;
			if($$.isObject(x)) {
				var t = $.fork(x.val, 1);
				if(meta && $$.isNumber(meta) && !isNaN(+meta.val)) {
					t.length = +meta.val;
				}
				return t;
			}
			if($$.isArray(x)) {
				var t = $.composition(x.val);
				if(meta && $$.isNumber(meta) && !isNaN(+meta.val)) {
					t.length = +meta.val;
				}
				return t;
			}
			if($$.isNumber(x)) return $.index('arguments', x);
			return this;
		}
	};
	stdlib['@@'] = {
		length: 1,
		unquotable: true,
		objectquoter: true,
		recobjectquoter: true,
		recarrayquoter: true,
		fn: function(x) {
			var $ = $$.from(this);
			var meta = this.op.meta;
			if($$.isObject(x)) {
				var t = $.fork(x.val, 2);
				if(meta && $$.isNumber(meta) && !isNaN(+meta.val)) {
					t.length = +meta.val;
				}
				return t;
			}
			return this;
		}
	};

	// Suffixes
	var suffix = {};

	suffix['m'] = function(o) {
		var $ = $$.from(o), x = o.val[0], n = uname();
		if($$.isOperator(o))
			return $.method(x, 'map', [$.fn([n], [$.operator(o.op, [n])])]);
		else
			return $.method(x, 'map', [$.fn([n], [$.call(o, [n])])]);
	};

	suffix['s'] = function(o) {
		var $ = $$.from(o), a = uname(), b = uname();
		return $.method(o, 'reduce', [$.fn([a, b], $.binOp('+', a, b)), 0]);
	};
	suffix['p'] = function(o) {
		var $ = $$.from(o), a = uname(), b = uname();
		return $.method(o, 'reduce', [$.fn([a, b], $.binOp('*', a, b)), 1]);
	};

	return {
		version: version,
		compile: compile,
		formatValue: formatValue
	};
})();

if(typeof global != 'undefined' && global) {
	// Export
	if(module && module.exports) module.exports = Miro;
	// Commandline
	if(require.main === module) {
		var args = process.argv.slice(2), l = args.length;
		if(l === 0) {
			// REPL
			var PARSEMODE = 0, EVALMODE = 1;
			var INITIALMODE = PARSEMODE;
			var INITIALFORMAT = false;
			var INITIALSTR = true;
			
			var mode = INITIALMODE, format = INITIALFORMAT, str = INITIALSTR;
			console.log('Miro '+Miro.version+' REPL');
			process.stdin.setEncoding('utf8');
			function input() {
				process.stdout.write('> ');
				process.stdin.once('data', function(s) {
					try {
						if(s.trim() == '!parse') mode = PARSEMODE;
						else if(s.trim() == '!eval') mode = EVALMODE;
						else if(s.trim() == '!format') format = true;
						else if(s.trim() == '!noformat') format = false;
						else if(s.trim() == '!str') str = true;
						else if(s.trim() == '!nostr') str = false;
						else if(mode == PARSEMODE) {
							var t = Miro.compile(s);
							if(str) {
								if(Array.isArray(t)) t = t.join(' ');
								t += '';
							}
							console.log(t);
						} else if(mode == EVALMODE) {
							var t = eval(Miro.compile(s));
							if(format) t = Miro.formatValue(t);
							console.log(t);
						}
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
						eval(Miro.compile(s));
					else console.log(Miro.compile(s));
				});
			}
		}
	}
}
