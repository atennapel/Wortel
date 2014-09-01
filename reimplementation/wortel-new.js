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
	
		// Handle infix
		for(var i = 0, l = r.length; i < l; i++) {
			var c = r[i], p = r[i-1];
			if(c instanceof WSymbol) {
				if(c.op.infix || (BINARY_IS_INFIX && c.op.length == 2 && c.op.infix !== false))
					c.infix = true;
				if(c.infix && i > 0 &&
					!(p instanceof WSymbol && p.op.quoter) &&
					!(p instanceof WComma) &&
					!(p instanceof WSemicolon)) {
					r[i-1] = c, r[i] = p;
					c.switched = true;
				}
			}
		}
	
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
			a.unshift(new WFnCall(c, a.shift().val));
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
		//return new WSemiGroup(toAST(tokenize(s))).compile();
		return new WSemiGroup(toAST(tokenize(s)));
	}

	function compileAll(a) {
		return a.map(function(x) {return x.compile()});
	}
	// Expr
	function WExpr(val) {};
	WExpr.prototype.toString = function() {return 'WExpr'};
	WExpr.prototype.isPlaceholder = function() {return false};
	WExpr.prototype.compile = function() {return ''+this};
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
	WComma.prototype.getArgs = function() {error('Invalid getArgs call on WComma.')};

	// Number
	function WNumber(n) {
		this.val = n;
	};
	extend(WNumber, WExpr);
	WNumber.prototype.toString = function() {return this.val};

	// Name
	var placeholder = new WName('.');
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

	// String
	function WString(n) {
		this.val = n;
	};
	extend(WString, WExpr);
	WString.prototype.toString = function() {return '"' + this.val + '"'};

	// RegExp
	function WRegExp(n, f) {
		this.val = n;
		this.flags = f;
	};
	extend(WRegExp, WExpr);
	WRegExp.prototype.toString = function() {
		return '/' + this.val + '/' + this.flags;
	};

	// Symbol
	function WSymbol(n) {
		this.val = n;
		this.op = op[n];
	};
	extend(WSymbol, WExpr);
	WSymbol.prototype.toString = function() {
		return (this.reversed? '~': '') + this.val;
	};
	WSymbol.prototype.getArgs = function(a, o) {
		var n = a[0];
		if(this.val == '~' && n instanceof WSymbol)
			a[0].reversed = true;
		else if(this.quoted) o.push(this);
		else {
			if(this.op.quoter && n instanceof WSymbol)
				a[0].quoted = true;
			var l = op[this.val].length, args = [], first = false;
			if(o.length == 0 && this.infix) first = true;
			while(args.length < l && (a.length > 0 || o.length > 0)) {
				var last = o[o.length-1];
				if(o.length > 0 && !(last instanceof WSemicolon)) args.push(o.pop());
				else if(a[0] instanceof WComma) break;
				else if(a.length > 0) a.shift().getArgs(a, o);
				else if(last instanceof WSemicolon) {o.pop(); break}
			}
			if(args.length < l || any(isPlaceholder, args)) {
				if(first && !this.switched && args.length > 0) this.reversed = !this.reversed;
				o.push(new WOpPartial(this, args));
			} else
				o.push(new WOpCall(this, args));
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

	// Call
	function WCall(fn, args) {};
	extend(WCall, WExpr);
	WCall.prototype.toString = function() {
		return this.fn + '(' + this.args.join(' ') + ')';
	};

	// OpCall
	function WOpCall(fn, args) {
		this.fn = fn;
		this.args = args;
	};
	extend(WOpCall, WCall);
	WOpCall.prototype.compile = function() {
		if(!this.fn.op.compile)
			error('Operator ' + this.fn.val + ' does not have a compile function.');
		return this.fn.op.compile.apply(
			this.fn.op,
			this.fn.reversed? [].concat(this.args).reverse(): this.args
		).compile();
	};
	
	// FnCall
	function WFnCall(fn, args) {
		this.fn = fn;
		this.args = args;
	};
	extend(WFnCall, WCall);
	WFnCall.prototype.compile = function() {
		return this.fn.compile() + '(' + compileAll(this.args).join(', ') + ')';	
	};

	// Partial
	function WPartial(fn, args)	{};
	extend(WPartial, WCall);
	WPartial.prototype.toString = function() {
		return this.fn + '{' + this.args.join(' ') + '}';
	};

	// OpPartial
	function WOpPartial(fn, args) {
		this.fn = fn;
		this.args = args;
	};
	extend(WOpPartial, WPartial);

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
	
	// operators
	var op = {};

	// Math
	op['+'] = {length: 2, compile: function(a, b) {return new WBinOp('+', a, b)}};
	op['-'] = {length: 2, compile: function(a, b) {return new WBinOp('-', a, b)}};
	op['*'] = {length: 2, compile: function(a, b) {return new WBinOp('*', a, b)}};
	op['/'] = {length: 2, compile: function(a, b) {return new WBinOp('/', a, b)}};
	op['%'] = {length: 2, compile: function(a, b) {return new WBinOp('%', a, b)}};
	op['@sum'] = {length: 1};

	// Function
	op['!'] = {
		length: 2
	};

	// Array
	op['!*'] = {
		length: 2
	};
	op['!/'] = {
		length: 2
	};

	// Partial
	op['\\'] = {
		length: 2,
		quoter: true
	};

	// Meta
	op['^'] = {
		length: 1,
		quoter: true,	
		compile: function(x) {return new WOpPartial(x, [])}
	};
	op['~'] = {
		length: 1,
		quoter: true
	};
	op["'"] = {
		length: 2
	};

	// Range
	op['..'] = {
		length: 2,
		compile: function(x, y) {return new WFnCall(new WName('_range'), [x, y])}
	};
	op['^..'] = {
		length: 2,
		compile: function(x, y) {return new WFnCall(new WName('_range'), [x, y])}
	};
	op['..^'] = {
		length: 2,
		compile: function(x, y) {return new WFnCall(new WName('_range'), [x, y])}
	};
	op['^..^'] = {
		length: 2,
		compile: function(x, y) {return new WFnCall(new WName('_range'), [x, y])}
	};

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
