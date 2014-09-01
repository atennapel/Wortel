/* Wortel compiler
 * @version: 0.1
 * @author: Albert ten Napel
 * @email: aptennap@gmail.com
 * @github: atennapel
 * @date: 2014-08-30
 *
 * TODO:
 */
var Wortel = (function() {
	var version = '0.1';

	var BRACKETS = '()[]{}';
	var BINARY_IS_INFIX = true;
	var DEBUG = false;

	// util
	function merge(a, b) {for(var k in a) b[k] = a[k]; return b};
	function wrap(x) {return Array.isArray(x)? x: [x]};
	function wWrap(x) {return x instanceof WArray? x: new WArray([x])};
	function gWrap(x) {return x instanceof WGroup? x: new WGroup([x])};
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
	function any(f, a) {
		for(var i = 0, l = a.length; i < l; i++)
			if(f(a[i])) return true;
		return false;
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
	Array.prototype.toString = function(x) {return '@[' + this.join(', ') + ']'};
	function extend(a, b) {a.prototype = Object.create(b.prototype)};
	function undef(x) {return typeof x == 'undefined'};
	var _uvar = 0;
	function uvar() {return new WName('_' + (_uvar++))};

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
	function isDigit(c) {return /[0-9]/.test(c)}
	function isIdent(c) {return /[a-z_\$\.]/i.test(c)}
	function isSymbol(c) {return '`~!@#%^&*-+=|\\:/?><'.indexOf(c) > -1}
	function isOpeningBracket(c) {var t = BRACKETS.indexOf(c); return t != -1 && !(t % 2)}
	function isClosingBracket(c) {var t = BRACKETS.indexOf(c); return t != -1 && t % 2}
	function otherBracket(c) {var t = BRACKETS.indexOf(c); return t == -1? false: BRACKETS[t + (t % 2? -1: 1)]};
	function isBracket(c) {return isOpeningBracket(c) || isClosingBracket(c)}
	function isWhitespace(c) {return /\s/.test(c)}
	function nextPart(s, i, n) {return s.slice(i, i+n)}

	function splitOp(o) {
		for(var i = 0, l = o.length, r = []; i < l; i++) {
			var c = o.slice(i);
			if(op[c]) {
				if(i > 0)
					pushAll(r, splitOp(o.slice(0, i)));
				return r.push({type: 'operator', val: c}), r;
			} else if(c.length == 1)
				error('Undefined operator: ' + c);
		}
	}

	function tokenize(s) {
		var START = 0, NUMBER = 1, NAME = 2, DQSTRING = 3;
		var COMMENT = 4, BLCOMMENT = 5, OPERATOR = 6, NAMEOPERATOR = 7;
		var QF = 8, QSTRING = 9, QBSTRING = 10, REGEXP = 11, REGEXPT = 12;
		var RXCOMMENT = 13, RXBLCOMMENT = 14;
		var state = START, esc = false, br = null, obr = null, lv = 0, tmp = null;
		for(var i = 0, l = s.length+1, r = [], t = []; i < l; i++) {
			var c = s[i] || ' ';
			if(state == START) {
				if(c == '"') state = DQSTRING;
				else if(c == ';') r.push({type: 'semicolon'});
				else if(c == ',') r.push({type: 'comma'});
				else if(nextPart(s, i, 4) == '^..^')
					i += 3, r.push({type: 'operator', val: '^..^'});
				else if(nextPart(s, i, 3) == '..^')
					i += 2, r.push({type: 'operator', val: '..^'});
				else if(nextPart(s, i, 2) == '..')
					i++, r.push({type: 'operator', val: '..'});
				else if(nextPart(s, i, 3) == '^..')
					i += 2, r.push({type: 'operator', val: '^..'});
				else if(c == "'" && i > 0 && !isWhitespace(s[i-1]))
					r.push({type: 'operator', val: "'"});
				else if(c == "'") state = QF;
				else if(nextPart(s, i, 2) == ';;') i++, state = COMMENT;
				else if(isOpeningBracket(c))
					r.push({type: 'open', val: c, whitespace: isWhitespace(s[i-1])});
				else if(isClosingBracket(c))
					r.push({type: 'close', val: otherBracket(c)});
				else if(isDigit(c)) state = NUMBER, i--;
				else if(isIdent(c)) tmp = isWhitespace(s[i-1]), state = NAME, i--;
				else if(isSymbol(c)) state = OPERATOR, i--;
			} else if(state == NUMBER) {
				if(nextPart(s, i, 2) == '..' || (!isDigit(c) && !isIdent(c) && c != '.')) {
					r.push({type: 'number', val: t.join('')});
					t = [];
					state = START, i--;
				} else t.push(c);
			} else if(state == NAME) {
				if(nextPart(s, i, 2) == '..' || (!isDigit(c) && !isIdent(c) && c != ':')) {
					r.push({type: 'name', val: t.join(''), whitespace: tmp});
					t = [];
					state = START, i--;
				} else t.push(c);
			} else if(state == DQSTRING) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') esc = true, t.push(c);
				else if(c == '\n') t.push('\\n');
				else if(c == '"')
					r.push({type: 'string', val: t.join('')}), t = [], state = START;
				else t.push(c);
			} else if(state == COMMENT) {
				if(isOpeningBracket(c))
					br = c, obr = otherBracket(c), lv++, state = BLCOMMENT;
				else if(c == '\n') state = START;
			} else if(state == BLCOMMENT) {
				if(c == br) lv++;
				else if(c == obr) {
					lv--;
					if(lv == 0) state = START;
				} 
			} else if(state == OPERATOR) {
				if(c == '@' && isIdent(s[i+1])) {
					if(t.length > 0)
						pushAll(r, splitOp(t.join('')));
					t = [c], state = NAMEOPERATOR;
				} else if(!isSymbol(c)) {
					pushAll(r, splitOp(t.join('')));
					t = [];
					state = START, i--;
				} else t.push(c);
			} else if(state == NAMEOPERATOR) {
				if(!isIdent(c) && !isDigit(c)) {
					r.push({type: 'operator', val: t.join('')});
					t = [];
					state = START, i--;
				} else t.push(c);
			} else if(state == QF) {
				if(c == '/') state = REGEXP;
				else if(isOpeningBracket(c))
					br = c, obr = otherBracket(c), lv = 1, state = QBSTRING;
				else i--, state = QSTRING;
			} else if(state == QSTRING) {
				if(!isIdent(c) && !isDigit(c) && !isSymbol(c))
					r.push({type: 'string', val: t.join('')}), t = [], state = START;
				else t.push(c);
			} else if(state == QBSTRING) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') esc = true, t.push(c);
				else if(c == br) t.push(c), lv++;
				else if(c == '\n') t.push('\\n');
				else if(c == obr) {
					lv--;
					if(lv == 0) {
						r.push({type: 'string', val: t.join(''), bracket: br});
						t = [];
						state = START;
					} else t.push(c);
				} else t.push(c); 
			} else if(state == REGEXP) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') esc = true, t.push(c);
				else if(c == '/') tmp = t.join(''), t = [], state = REGEXPT;
				else if(nextPart(s, i, 2) == ';;') i++, state = RXCOMMENT;
				else if(c == '\n') t.push('\\n');
				else t.push(c);
			} else if(state == REGEXPT) {
				if(!isIdent(c)) {
					r.push({type: 'regexp', val: tmp, flags: t.join('')});
					t = [], i--, state = START;
				} else t.push(c);
			} else if(state == RXCOMMENT) {
				if(isOpeningBracket(c))
					br = c, obr = otherBracket(c), lv++, state = RXBLCOMMENT;
				else if(c == '\n') state = REGEXP;
			} else if(state == RXBLCOMMENT) {
				if(c == br) lv++;
				else if(c == obr) {
					lv--;
					if(lv == 0) state = REGEXP;
				}
			}
		}
		return r;
	}

	function toAST(a) {
		var br = null, lv = 0, t = [], r = [], w = false;
		for(var i = 0, l = a.length; i < l; i++) {
			var c = a[i], ty = c.type, v = c.val;
			if(!br) {
				if(ty == 'open') br = v, w = c.whitespace, lv++;
				else if(ty == 'close')
					error('Closing bracket before opening: ' + otherBracket(v));
				else if(ty == 'number') r.push(new WNumber(v));
				else if(ty == 'name') r.push(new WName(v, c.whitespace));
				else if(ty == 'string') r.push(new WString(v));
				else if(ty == 'regexp') r.push(new WRegExp(v, c.flags));
				else if(ty == 'operator') r.push(new WSymbol(v));
				else if(ty == 'semicolon') r.push(new WSemicolon());
				else if(ty == 'comma') r.push(new WComma());
				else error('Invalid token type: ' + ty);
			} else {
				if(ty == 'open' && br == v) t.push(c), lv++;
				else if(ty == 'close' && br == v) {
					lv--;
					if(lv == 0) {
						r.push(new (
							v == '('? WGroup:
							v == '['? WArray:
							v == '{'? WObject:
							error('Invalid bracket: ' + v))(toAST(t), w));
						t = [], br = null;
					} else t.push(c);
				} else t.push(c);
			}
		}
		if(br) error('Unclosed bracket: ' + br);
	
		// Give args to operators
		var o = [];
		while(r.length > 0)
			r.shift().getArgs(r, o);

		return o;
	}

	function checkIndexer(c, a) {
		var n = a[0];
		if(n instanceof WName && n.isIndexer() && !n.whitespace) {
			a.unshift(new WProp(c, a.shift().indexless()));
			return true;
		}
		return false;
	}

	function checkGroup(c, a) {
		var n = a[0];
		if(n instanceof WGroup && !n.whitespace) {
			a.unshift(new WCall(c, a.shift().val));
			return true;
		}
		return false;
	}

	function checkArray(c, a) {
		var n = a[0];
		if(n instanceof WArray && !n.whitespace) {
			a.unshift(new WIndex(c, a.shift().val));
			return true;
		}
		return false;
	}

	function compile(s) {
		return optimize(new WSemiGroup(toAST(tokenize(s)))).compile();
		//return optimize(new WSemiGroup(toAST(tokenize(s))));
	}

	function optimizeArray(a) {
		return a.map(function(x) {return x.optimize()});
	}

	function optimize(c) {
		var i = 0;
		console.log('optimize #' + (i) + ': ' + (c+''));
		var h = null, c = c.optimize(i), t = c.hash();
		while(t !== h) {
			i++;
			console.log('optimize #' + (i) + ': ' + (c + ''));
			h = t, c = c.optimize(i), t = c.hash();
		}
		// console.log(c);
		return c;
	}

	function compileAll(a) {
		return a.map(function(x) {return x.compile()});
	}
	// Expr
	function WExpr(val) {};
	WExpr.prototype.toString = function() {return 'WExpr'};
	WExpr.prototype.isPlaceholder = function() {return false};
	WExpr.prototype.isFn = function() {return false};
	WExpr.prototype.compile = function() {error('Cannot compile ' + this)};
	WExpr.prototype.optimize = function() {return this};
	WExpr.prototype.hash = function() {return this.toString()};
	WExpr.prototype.getArgs = function(a, o) {
		if(checkIndexer(this, a, o)) return;
		if(checkGroup(this, a, o)) return;
		if(checkArray(this, a, o)) return;
		o.push(this);
	};

	// Semicolon
	function WSemicolon() {};
	extend(WSemicolon, WExpr);
	WSemicolon.prototype.toString = function() {return 'WSemicolon'};
	WSemicolon.prototype.getArgs = function(a, o) {o.push(this)};
	
	// Comma
	function WComma() {};
	extend(WComma, WExpr);
	WComma.prototype.toString = function() {return 'WComma'};
	WComma.prototype.getArgs = function() {};

	// Number
	function WNumber(n) {
		this.val = n;
	};
	extend(WNumber, WExpr);
	WNumber.prototype.toString = function() {return this.val};
	WNumber.prototype.compile = function() {return ''+this};

	// Name
	function isPlaceholder(x) {return x.isPlaceholder()};
	function WName(n, w) {
		this.val = n;
		this.whitespace = w;
	};
	extend(WName, WExpr);
	WName.prototype.toString = function() {return this.val};
	WName.prototype.isPlaceholder = function() {return this.val == '.'};
	WName.prototype.isIndexer = function() {return this.val[0] == '.' && !this.isPlaceholder()};
	WName.prototype.indexless = function() {
		if(this.isIndexer())
			return new WName(this.val.slice(1), this.whitespace);
		else return this;
	};
	WName.prototype.getArgs = function(a, o) {
		if(checkIndexer(this, a, o)) return;
		if(checkGroup(this, a, o)) return;
		if(checkArray(this, a, o)) return;
		o.push(this);
	};
	WName.prototype.compile = function() {return ''+this};
	var placeholder = new WName('.');

	// String
	function WString(n) {
		this.val = n;
	};
	extend(WString, WExpr);
	WString.prototype.toString = function() {return '"' + this.val + '"'};
	WString.prototype.compile = function() {return ''+this};

	// RegExp
	function WRegExp(n, f) {
		this.val = n;
		this.flags = f;
	};
	extend(WRegExp, WExpr);
	WRegExp.prototype.toString = function() {
		return '/' + this.val + '/' + this.flags;
	};
	WRegExp.prototype.compile = function() {return ''+this};

	// Symbol
	function WSymbol(n) {
		this.val = n;
		this.op = op[n];
	};
	extend(WSymbol, WExpr);
	WSymbol.prototype.toString = function() {
		return (this.reversed? '~': '') + this.val;
	};
	WSymbol.prototype.compile = function() {error('Cannot compile symbol: ' + this.val)};
	WSymbol.prototype.getArgs = function(a, o) {
		var n = a[0];
		if(this.val == '~' && n instanceof WSymbol)
			n.reversed = true;
		else if(this.quoted) o.push(this);
		else {
			var l = op[this.val].length, args = [], first = false;
			if(o.length == 0) first = true;
			var quotes = [].concat(this.op.quotes);
			if(this.reversed) quotes.reverse();
			var i = 0;
			while(args.length < l && (a.length > 0 || o.length > 0)) {
				var last = o[o.length-1];
				if(o.length > 0 && !(last instanceof WSemicolon)) args.push(o.pop()), i++;
				else if(a[0] instanceof WComma) break;
				else if(a.length > 0) {
					if(a[0] instanceof WSymbol && quotes[i]) args.push(a.shift());
					else a.shift().getArgs(a, o);
				} else if(last instanceof WSemicolon) {o.pop(); break}
			}
			if(first && args.length > 0 && (this.op.infix ||
				(this.op.length == 2 && BINARY_IS_INFIX && this.op.infix !== false)))
				this.addfirst = true;
			o.push(new WCall(this, args));
		}
	};

	// List
	function WList(val) {};
	extend(WList, WExpr);
	WList.prototype.toString = function() {
		return 'WList(' + this.val.join(' ') + ')';
	};

	// Array
	function WArray(a, w) {
		this.val = a;
		this.whitespace = w;
	};
	extend(WArray, WList);
	WArray.prototype.toString = function() {
		return '[' + this.val.join(' ') + ']';
	};
	WArray.prototype.compile = function() {
		return '[' + compileAll(this.val).join(', ') + ']';
	};
	WArray.prototype.getArgs = function(a, o) {
		if(checkIndexer(this, a, o)) return;
		if(checkArray(this, a, o)) return;
		o.push(this);
	};
	WArray.prototype.optimize = function() {
		return new WArray(optimizeArray(this.val), this.whitespace);
	};
	
	// Group
	function WGroup(a, w) {
		this.val = a;
		this.whitespace = w;
	};
	extend(WGroup, WList);
	WGroup.prototype.toString = function() {
		return '(' + this.val.join(' ') + ')';
	};
	WGroup.prototype.compile = function() {
		return '(' + compileAll(this.val).join(', ') + ')';
	};
	WGroup.prototype.getArgs = function(a, o) {
		if(checkIndexer(this, a, o)) return;
		if(checkGroup(this, a, o)) return;
		if(checkArray(this, a, o)) return;
		o.push(this);
	};
	WGroup.prototype.optimize = function() {
		var a = this.val, c = a[0];
		if(a.length == 0) return new WName('undefined');
		if(a.length == 1 && (
			/*
			c instanceof WPartial ||
			c instanceof WCall 
			*/ true
		)) return c;
		return new WGroup(optimizeArray(a), this.whitespace);
	};

	// Object
	function WObject(a, w) {
		this.val = a;
		this.whitespace = w;
	};
	extend(WObject, WList);
	WObject.prototype.toString = function() {
		return '{' + this.val.join(' ') + '}';
	};
	WObject.prototype.compile = function() {
		for(var i = 0, a = this.val, l = a.length, r = []; i < l; i += 2)
			r.push(a[i].compile() + ': ' + a[i+1].compile());
		return '{' + r.join(', ') + '}';
	};
	WObject.prototype.getArgs = function(a, o) {
		if(checkIndexer(this, a, o)) return;
		if(checkArray(this, a, o)) return;
		o.push(this);
	};
	WObject.prototype.optimize = function() {
		return new WObject(optimizeArray(this.val), this.whitespace);
	};

	// SemiGroup
	function WSemiGroup(a) {
		this.val = a;
	};
	extend(WSemiGroup, WList);
	WSemiGroup.prototype.toString = function() {
		return '(' + this.val.join('; ') + ')';
	};
	WSemiGroup.prototype.compile = function() {
		return compileAll(this.val).join('; ');
	};
	WSemiGroup.prototype.optimize = function() {
		return new WSemiGroup(optimizeArray(this.val), this.whitespace);
	};

	// Call
	function WCall(fn, args) {
		this.fn = fn;
		this.args = args;
	};
	extend(WCall, WExpr);
	WCall.prototype.optimize = function() {
		var a = optimizeArray(this.args), f = this.fn;
		if(f instanceof WSymbol) {
			if(!f.op.compile)
				error('Operator ' + f.val + ' does not have a compile function.');
			for(var i = 0, ll = a.length, fnargs = false; i < ll; i++)
				if(!f.op.fnargs[i] && a[i].isFn()) {fnargs = true; break}
			if(a.length < f.op.length || any(isPlaceholder, a) || fnargs) {
				if(this.addfirst) a.unshift(placeholder);
				return new WPartial(f, a);
			}
			return f.op.compile.apply(f.op, f.reversed? a.reverse(): a);
		} else if(any(isPlaceholder, a)) return new WPartial(f, a);
		return this;
	};
	WCall.prototype.toString = function() {
		return this.fn + '(' + this.args.join(' ') + ')';	
	};
	WCall.prototype.compile = function() {
		return this.fn.compile() + '(' + compileAll(this.args).join(', ') + ')';	
	};
	
	// Partial
	function WPartial(fn, args)	{
		this.fn = fn;
		this.args = args;
	};
	extend(WPartial, WCall);
	WPartial.prototype.isFn = function() {return true};
	WPartial.prototype.toString = function() {
		return this.fn + '{' + this.args.join(' ') + '}';
	};
	WPartial.prototype.compile = function() {error('Cannot compile a partial')};
	WPartial.prototype.optimize = function() {
		var a = this.args, args = this.targs || [], l = a.length;
		if(this.fn instanceof WSymbol) {
			l = this.fn.op.length;
			if(a.length > l) error('Too many arguments for the partial application of ' + this.fn);
			while(a.length < l) a.push(placeholder);
		}
		for(var i = 0; i < l; i++) {
			if(a[i].isPlaceholder()) {
				var v = uvar();
				a[i] = v;
				args.push(v);
			} else if(a[i] instanceof WPartial) {
				a[i].nofn = true;
				a[i].targs = args;
				a[i] = a[i].optimize();
			} else a[i] = a[i].optimize();
		}
		if(this.nofn)
			return new WCall(this.fn, a);
		return new WFn(new WGroup(args), new WCall(this.fn, a));
	};

	// Index
	function WIndex(obj, inx) {
		this.obj = obj;
		this.inx = inx;
	}
	extend(WIndex, WExpr);
	WIndex.prototype.toString = function() {
		return this.obj + '[' + this.inx.join(' ') + ']';
	};
	WIndex.prototype.compile = function() {
		return this.obj.compile() + '[' + compileAll(this.inx).join(', ') + ']';
	};
	WIndex.prototype.optimize = function() {
		return new WIndex(this.obj.optimize(), this.inx.optimize());
	};
	
	// Index
	function WProp(obj, prop) {
		this.obj = obj;
		this.prop = prop;
	}
	extend(WProp, WExpr);
	WProp.prototype.toString = function() {
		return this.obj + '.' + this.prop;
	};
	WProp.prototype.compile = function() {
		return this.obj.compile() + '.' + this.prop.compile();
	};
	WProp.prototype.optimize = function() {
		return new WProp(this.obj.optimize(), this.prop.optimize());
	};

	// BinOp
	function WBinOp(op, a, b) {
		this.op = op;
		this.a = a;
		this.b = b;	
	}
	extend(WBinOp, WExpr);
	WBinOp.prototype.toString = function() {
		return '(' + this.a + ' ' + this.op + ' ' + this.b + ')';
	};
	WBinOp.prototype.compile = function() {
		return '(' + this.a.compile() + ' ' + this.op + ' ' + this.b.compile() + ')';
	};
	WBinOp.prototype.optimize = function() {
		return new WBinOp(this.op, this.a.optimize(), this.b.optimize());
	};

	// Fn
	function WFn(args, body, ret, name) {
		this.name = name || '';
		this.args = gWrap(args);
		this.body = body;
		this.ret = undef(ret)? true: ret;
	}
	extend(WFn, WExpr);
	WFn.prototype.toString = function() {
		return 'Fn ' + this.name + this.args + ' ' + this.body;
	};
	WFn.prototype.optimize = function() {
		return new WFn(this.args, this.body.optimize(), this.ret, this.name);
	};
	WFn.prototype.compile = function() {
		if(this.ret)
			return 'function ' + this.name +  this.args.compile() + ' {return ' + this.body.compile() + '}';
		return 'function ' + this.name +  this.args.compile() + ' {' + this.body.compile() + '}';
	};
	
	// operators
	var op = {};

	// Math
	op['+'] = {compile: function(a, b) {return new WBinOp('+', a, b)}};
	op['-'] = {compile: function(a, b) {return new WBinOp('-', a, b)}};
	op['*'] = {compile: function(a, b) {return new WBinOp('*', a, b)}};
	op['/'] = {compile: function(a, b) {return new WBinOp('/', a, b)}};
	op['%'] = {compile: function(a, b) {return new WBinOp('%', a, b)}};
	op['@sum'] = {compile: function(a) {return new WCall(new WName('_sum'), [a])}};
	op['@prod'] = {compile: function(a) {return new WCall(new WName('_prod'), [a])}};
	op['@sqrt'] = {compile: function(a) {return new WCall(new WName('Math.sqrt'), [a])}};
	op['@^'] = {compile: function(a, b) {return new WCall(new WName('Math.pow'), [a, b])}};

	op['='] = {compile: function(a, b) {return new WBinOp('===', a, b)}};
	op['!='] = {compile: function(a, b) {return new WBinOp('!==', a, b)}};
	op['=='] = {compile: function(a, b) {return new WBinOp('==', a, b)}};
	op['!=='] = {compile: function(a, b) {return new WBinOp('!=', a, b)}};
	op['>'] = {compile: function(a, b) {return new WBinOp('>', a, b)}};
	op['<'] = {compile: function(a, b) {return new WBinOp('<', a, b)}};
	op['>='] = {compile: function(a, b) {return new WBinOp('>=', a, b)}};
	op['<='] = {compile: function(a, b) {return new WBinOp('<=', a, b)}};

	// Function
	op['!'] = {
		fnargs: [true, false],
		compile: function(f, a) {return new WCall(f, [a])}
	};
	op['@!'] = {
		fnargs: [true, false],
		compile: function(f, a) {return new WCall(new WName('_apply'), [f, a])}
	};
	op['!!'] = {
		fnargs: [true, false, false],
		infix: true,
		compile: function(f, a, b) {return new WCall(f, [a, b])}
	};
	op['&'] = {
		compile: function(a, b) {return new WFn(a, b)}
	};

	// Array
	op['!*'] = {
		fnargs: [true, false],
		compile: function(f, a) {return new WCall(new WName('_map'), [f, a])}
	};
	op['!/'] = {
		fnargs: [true, false],
		compile: function(f, a) {return new WCall(new WName('_fold'), [f, a])}
	};
	op['!-'] = {
		fnargs: [true, false],
		compile: function(f, a) {return new WCall(new WName('_filter'), [f, a])}
	};

	// Partial
	op['\\'] = {
		infix: false,
		quotes: [true, false],
		compile: function(f, a) {return new WPartial(f, [a])}
	};
	op['@\\'] = {
		infix: false,
		quotes: [true, false],
		compile: function(f, a) {return new WPartial(f, [placeholder, a])}
	};
	op['&\\'] = {
		infix: false,
		quotes: [true, false],
		compile: function(f, a) {return new WPartial(f, a.val)}
	};

	// Meta
	op['^'] = {
		quotes: [true],
		compile: function(x) {return new WPartial(x, [])}
	};
	op['~'] = {
		length: 1
	};
	op["'"] = {
		length: 2
	};

	// Range
	op['..'] = {
		compile: function(x, y) {return new WCall(new WName('_range'), [x, y])}
	};
	op['^..'] = {
		compile: function(x, y) {return new WCall(new WName('_range'), [x, y])}
	};
	op['..^'] = {
		compile: function(x, y) {return new WCall(new WName('_range'), [x, y])}
	};
	op['^..^'] = {
		compile: function(x, y) {return new WCall(new WName('_range'), [x, y])}
	};

	function normalizeOps() {
		for(var k in op) {
			var o = op[k];
			if(undef(o.length)) o.length = o.compile.length;
			if(undef(o.fnargs)) {
				for(var i = 0, l = o.length, a = []; i < l; i++)
					a.push(false);
				o.fnargs = a;
			}
			if(undef(o.quotes)) {
				for(var i = 0, l = o.length, a = []; i < l; i++)
					a.push(false);
				o.quotes = a;
			}
		}
	}
	normalizeOps();

	return {
		version: version,
		compile: compile,
		formatValue: formatValue
	};
})();

if(typeof global != 'undefined' && global) {
	// Export
	if(module && module.exports) module.exports = Wortel;
	// Commandline
	if(require.main === module) {
		var args = process.argv.slice(2), l = args.length;
		if(l === 0) {
			// REPL
			var PARSEMODE = 0, EVALMODE = 1;
			var INITIALMODE = PARSEMODE;
			var INITIALFORMAT = true;
			var INITIALSTR = true;
			
			var mode = INITIALMODE, format = INITIALFORMAT, str = INITIALSTR;
			console.log('Wortel '+Wortel.version+' REPL');
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
							var t = Wortel.compile(s);
							if(str) {
								if(Array.isArray(t)) t = t.join(' ');
								t += '';
							}
							//if(format) t = Wortel.formatValue(t);
							console.log(t);
						} else if(mode == EVALMODE) {
							var t = eval(Wortel.compile(s));
							if(format) t = Wortel.formatValue(t);
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
						eval(Wortel.compile(s));
					else console.log(Wortel.compile(s));
				});
			}
		}
	}
}
