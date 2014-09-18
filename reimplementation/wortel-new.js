/* Wortel compiler
 * @version: 0.3
 * @author: Albert ten Napel
 * @email: aptennap@gmail.com
 * @github: atennapel
 * @date: 2014-08-30
 *
 * tokenize -> toAST -> compile -> reduce -> toJs
 *
 * TODO:
 * 	
 */
var Wortel = (function() {
	var version = '0.3';

	var BRACKETS = '()[]{}';
	var DEBUG = false;
	var FILTER_SEMICOLON = true;
	var JS_UNARY = {
		'delete': true, 'void': true, 'typeof': true, '++': true,
		'--': true, '+': true, '-': true, '~': true, '!': true
	};
	var JS_BINARY = {
		'+': true, '-': true, '*': true, '/': true, '%': true,
		'<<': true, '>>': true, '>>>': true, '&': true, '|': true, '^': true,
		'<': true, '>': true, '<=': true, '>=': true, '==': true, '===': true, '!=': true, '!==': true,
		'=': true, '*=': true, '/=': true, '%=': true, '+=': true, '-=': true, '<<=': true, '>>=': true, '>>>=': true, '&=': true, '^=': true, '|=': true,
		'&&': true, '||': true,
		',': true
	};
	var JS_TERNARY = {
		'?:': true
	};

	// util
	function obj(o) {
		o = o || {};
		o.init = o.init || function() {};
		o.extend = o.extend || null;
		if(o.extend) o.init.prototype = Object.create(o.extend.prototype);
		if(o) for(var m in o) if(m != 'init' && m != 'extend') o.init.prototype[m] = o[m];
		return o.init;
	}
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
	function isSymbol(c) {return '`~!@#%^&*-+=|\\:;/?><,'.indexOf(c) > -1}
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
		var RXCOMMENT = 13, RXBLCOMMENT = 14, META = 15;
		var state = START, esc = false, br = null, obr = null, lv = 0, tmp = null;
		for(var i = 0, l = s.length+1, r = [], t = []; i < l; i++) {
			var c = s[i] || ' ';
			if(state == START) {
				if(c == '"') state = DQSTRING;
				else if(c == "'" && i > 0 && !isWhitespace(s[i-1]))
					state = META, t.push(c);
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
				if(!isDigit(c) && !isIdent(c) && c != '.') {
					r.push({type: 'number', val: t.join('')});
					t = [];
					state = START, i--;
				} else t.push(c);
			} else if(state == NAME) {
				if(!isDigit(c) && !isIdent(c) && c != ':') {
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
			} else if(state == META) {
				if(c == "'") t.push(c);
				else r.push({type: 'operator', val: t.join('')}), t = [], i--, state = START;
			}
		}
		return r;
	}

	function toAST(a) {
		if(FILTER_SEMICOLON)
			a = a.filter(function(x) {return x.type != 'operator' || x.val != ';'});
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

		console.log(r.join(' '));

		// handle meta operator
		for(var i = 0; i < r.length; i++) {
			var c = r[i], p = r[i-1], n = r[i+1];
			if(c instanceof WSymbol) {
				if(c.val[0] == "'") {
					if(p) r.splice(i-1, 1), i--;
					if(n) r.splice(i+1, 1);
					r[i] = new WCall(c, [p || placeholder, n || placeholder]);
				}
			}
		}
	
		// Give args to operators
		var o = [];
		while(r.length > 0)
			r.shift().getArgs(r, o);

		console.log(o.join(' '));

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
		//return new WSemiGroup(toAST(tokenize(s))).compile().toJs();
		return new WSemiGroup(toAST(tokenize(s))).compile();
	}

	function compileAll(a) {
		return a.map(function(x) {return x.compile()});
	}
	function AllToJs(a) {
		return a.map(function(x) {return x.toJs()});
	}

	// Expr
	var WExpr = obj({
		toString: function() {return 'WExpr'},
		isPlaceholder: function() {return false},
		isFn: function() {return false},
		toJs: function() {error('Cannot compile to Javascript ' + this)},
		compile: function() {return this},
		reduce: function() {return this},
		getArgs: function(a, o) {
			if(checkIndexer(this, a, o)) return;
			if(checkGroup(this, a, o)) return;
			if(checkArray(this, a, o)) return;
			o.push(this);
		},
		addMeta: function(o) {
			this.meta = this.meta || [];
			this.meta.push(o);
			return this;
		}
	});

	// Number
	function compileNumber(s) {
		var str = s.replace(/\$|\_/g, '');
		if(/^0x[0-9a-f]+$/i.test(str)) return str;
		else if(/^0b[01]+$/i.test(str)) return parseInt(str.slice(2), 2);
		else if(/^0o[0-7]+$/i.test(str)) return parseInt(str.slice(2), 8);
		else if(/^[0-9]+x[0-9]+$/.test(str)) {
			var f = str.match(/^[0-9]+x/)[0];
			return ''+parseInt(str.slice(f.length), +f.slice(0, -1));
		}
		else if(/^[0-9]*\.[0-9]+$|^[0-9]+$/.test(str)) return str;
		else if(/^([0-9]*\.[0-9]+|[0-9]+)N$/.test(str)) return '-' + str.slice(0, -1);
		else error('Invalid number ' + s);
	}
	var WNumber = obj({
		extend: WExpr,
		init: function(n) {
			this.val = n;
		},
		toString: function() {return this.val},
		toJs: function() {return ''+this},
		compile: function() {
			return new WNumber(compileNumber(this.val));
		}
	});

	// Name
	function isPlaceholder(x) {return x.isPlaceholder()};
	var WName = obj({
		extend: WExpr,
		init: function(n, w) {
			this.val = n;
			this.whitespace = w;
		},
		toString: function() {return this.val},
		isPlaceholder: function() {return this.val == '.'},
		isIndexer: function() {return this.val[0] == '.' && !this.isPlaceholder()},
		indexless: function() {
			if(this.isIndexer())
				return new WName(this.val.slice(1), this.whitespace);
			else return this;
		},
		getArgs: function(a, o) {
			if(checkIndexer(this, a, o)) return;
			if(checkGroup(this, a, o)) return;
			if(checkArray(this, a, o)) return;
			o.push(this);
		},
		toJs: function() {return ''+this}
	});
	var placeholder = new WName('.');

	// String
	var WString = obj({
		extend: WExpr,
		init: function(n) {
			this.val = n;
		},
		toString: function() {return '"' + this.val + '"'},
		toJs: function() {return ''+this}
	});

	// RegExp
	var WRegExpr = obj({
		extend: WExpr,
		init: function(n, f) {
			this.val = n;
			this.flags = f;
		},
		toString: function() {
			return '/' + this.val + '/' + this.flags;
		},
		toJs: function() {return ''+this}
	});

	// Symbol
	var WSymbol = obj({
		extend: WExpr,
		init: function(n) {
			this.val = n;
			this.op = op[n];
		},
		toString: function() {
			return (this.reversed? '~': '') + this.val;
		},
		getArgs: function(a, o) {
			var n = a[0];
			if(this.val == '~' && n instanceof WSymbol)
				n.reversed = true;
			else if(this.quoted && !this.op.unquotable) o.push(this);
			else {
				var l = op[this.val].length, args = [];
				var quotes = [].concat(this.op.quotes); if(this.reversed) quotes.reverse();
				var i = 0, sl = o.length;
				while(args.length < l && (a.length > 0 || (o.length - sl) > 0)) {
					if(o.length > sl)
						args.push(o.pop());
					else if(a[0] instanceof WSymbol && quotes[i] && !a[0].op.unquotable)
						args.push(a.shift());
					else a.shift().getArgs(a, o);
					i++;
				}
				o.push(new WCall(this, args));
			}
		}
	});

	// List
	var WList = obj({
		extend: WExpr,
		toString: function() {
			return 'WList(' + this.val.join(' ') + ')';
		}
	});

	// Array
	var WArray = obj({
		extend: WList,
		init: function(a, w) {
			this.val = a;
			this.whitespace = w;
		},
		toString: function() {
			return '[' + this.val.join(' ') + ']';
		},
		toJs: function() {
			return '[' + compileAll(this.val).join(', ') + ']';
		},
		getArgs: function(a, o) {
			if(checkIndexer(this, a, o)) return;
			if(checkArray(this, a, o)) return;
			o.push(this);
		},
		compile: function() {
			return new WArray(compileAll(this.val));
		}
	});
	
	// Group
	var WGroup = obj({
		extend: WList,
		init: function(a, w) {
			this.val = a;
			this.whitespace = w;
		},
		toString: function() {
			return '(' + this.val.join(' ') + ')';
		},
		toJs: function() {
			return '(' + compileAll(this.val).join(', ') + ')';
		},
		getArgs: function(a, o) {
			if(checkIndexer(this, a, o)) return;
			if(checkGroup(this, a, o)) return;
			if(checkArray(this, a, o)) return;
			o.push(this);
		},
		compile: function() {
			return new WGroup(compileAll(this.val));
		}
	});

	// Object
	var WObject = obj({
		extend: WList,
		init: function(a, w) {
			this.val = a;
			this.whitespace = w;
		},
		toString: function() {
			return '{' + this.val.join(' ') + '}';
		},
		toJs: function() {
			for(var i = 0, a = this.val, l = a.length, r = []; i < l; i += 2)
				r.push(a[i].toJs() + ': ' + a[i+1].toJs());
			return '{' + r.join(', ') + '}';
		},
		getArgs: function(a, o) {
			if(checkIndexer(this, a, o)) return;
			if(checkArray(this, a, o)) return;
			o.push(this);
		},
		compile: function() {
			return new WObject(compileAll(this.val));
		}
	});

	// SemiGroup
	var WSemiGroup = obj({
		extend: WList,
		init: function(a) {
			this.val = a;
		},
		toString: function() {
			return '(' + this.val.join('; ') + ')';
		},
		toJs: function() {
			return compileAll(this.val).join('; ');
		},
		compile: function() {
			return new WSemiGroup(compileAll(this.val));
		}
	});

	// Call
	var WCall = obj({
		extend: WExpr,
		init: function(fn, args) {
			this.fn = fn;
			this.args = args;
		},
		toString: function() {
			return this.fn + '(' + this.args.join(' ') + ')';	
		},
		toJs: function() {
			var a = AllToJs(this.args);
			if(this.fn instanceof WName) {
				if(JS_UNARY[this.fn.val] && this.args.length == 1)
					return '(' + this.fn.val + ' ' + a[0] + ')';
				if(JS_BINARY[this.fn.val] && this.args.length == 2)
					return '(' + a[0] + ' ' + this.fn.val + ' ' + a[1] + ')';
				if(JS_TERNARY[this.fn.val] && this.args.length == 3) {
					var ta = this.fn.val[0], tb = this.fn.val[1];
					return '(' + a[0] + ' ' + ta + ' ' + a[1] + ' ' + tb + ' ' + a[2] + ')';
				}
			}
			return this.fn.toJs() + '(' + a.join(', ') + ')';	
		},
		compile: function() {
			var a = compileAll(this.args);
			if(this.fn instanceof WSymbol) {
				var o = this.fn.op, c = o.compile;
				if(o.length != a.length)
					error('Invalid amount of arguments for ' + this.fn);
				if(this.fn.reversed) a.reverse();
				if(typeof c == 'string')
					return new WCall(new WName(c), a);
				return c.apply(o, a);
			}
			return this;
		}
	});
	
	// Partial
	var WPartial = obj({
		extend: WCall,
		init: function(fn, args) {
			this.fn = fn;
			this.args = args;
		},
		isFn: function() {return true},
		toString: function() {
			return this.fn + '{' + this.args.join(' ') + '}';
		},
		toJs: function() {error('Cannot compile a partial')}
	});

	// Index
	var WIndex = obj({
		extend: WExpr,
		init: function(obj, inx) {
			this.obj = obj;
			this.inx = inx;
		},
		toString: function() {
			return this.obj + '[' + this.inx.join(' ') + ']';
		},
		toJs: function() {
			return this.obj.toJs() + '[' + compileAll(this.inx).join(', ') + ']';
		}
	});
	
	// Index
	var WProp = obj({
		extend: WExpr,
		init: function(obj, prop) {
			this.obj = obj;
			this.prop = prop;
		},
		toString: function() {
			return this.obj + '.' + this.prop;
		},
		toJs: function() {
			return this.obj.toJs() + '.' + this.prop.toJs();
		}
	});

	// Fn
	var WFn = obj({
		extend: WExpr,
		init: function(args, body, ret, name) {
			this.name = name || '';
			this.args = gWrap(args);
			this.body = body;
			this.ret = undef(ret)? true: ret;
		},
		toString: function() {
			return 'Fn ' + this.name + this.args + ' ' + this.body;
		},
		toJs: function() {
			if(this.ret)
				return 'function ' + this.name +  this.args.toJs() + ' {return ' + this.body.toJs() + '}';
			return 'function ' + this.name +  this.args.toJs() + ' {' + this.body.toJs() + '}';
		}
	});
	
	// operators
	var op = {};

	// Math
	op['@+'] = {length: 1, compile: 'unary_plus'};
	op['@-'] = {length: 1, compile: 'negate'};

	op['+'] = {length: 2, compile: 'add'};
	op['-'] = {length: 2, compile: 'sub'};
	op['*'] = {length: 2, compile: 'mul'};
	op['/'] = {length: 2, compile: 'div'};
	op['%'] = {length: 2, compile: 'rem'};
	op['@^'] = {length: 2, compile: 'Math.pow'};

	op['='] = {length: 2, compile: 'seq'};
	op['!='] = {length: 2, compile: 'sneq'};
	op['=='] = {length: 2, compile: 'eq'};
	op['!=='] = {length: 2, compile: 'neq'};
	op['>'] = {length: 2, compile: 'gr'};
	op['<'] = {length: 2, compile: 'ls'};
	op['>='] = {length: 2, compile: 'greq'};
	op['<='] = {length: 2, compile: 'lseq'};

	// Function
	op['!'] = {
		fnargs: [true, true],
		compile: function(f, a) {return new WCall(f, [a])}
	};
	op['@!'] = {
		fnargs: [true, false],
		length: 2,
		compile: 'apply'
	};
	op['!!'] = {
		fnargs: [true, true, true],
		compile: function(f, a, b) {return new WCall(f, [a, b])}
	};
	op['&'] = {
		unquotable: true,
		compile: function(a, b) {return new WFn(a, b)}
	};

	// Array
	op['#'] = {
		length: 1,
		compile: 'length'
	};
	op['!*'] = {
		fnargs: [true, false],
		length: 2,
		compile: 'map'
	};
	op['!/'] = {
		fnargs: [true, false],
		length: 2,
		compile: 'fold'
	};
	op['!-'] = {
		fnargs: [true, false],
		length: 2,
		compile: 'filter'
	};
	op['@#'] = {
		fnargs: [true, false],
		length: 2,
		compile: 'count'
	};

	// Partial
	op['\\'] = {
		unquotable: true,
		quotes: [true, true],
		compile: function(f, a) {return new WPartial(f, [a])}
	};
	op['@\\'] = {
		unquotable: true,
		quotes: [true, true],
		compile: function(f, a) {return new WPartial(f, [placeholder, a])}
	};
	op['&\\'] = {
		unquotable: true,
		quotes: [true, false],
		compile: function(f, a) {return new WPartial(f, a.val)}
	};

	// Meta
	op['^'] = {
		unquotable: true,
		quotes: [true],
		compile: function(x) {
			if(x instanceof WSymbol)
				return new WPartial(x, []);
			else if(x instanceof WObject) {
				var a = x.val;
				return new WCall(new WName('range'), [a[0], a[1]]);
			} else if(x instanceof WNumber)
				return new WCall(new WName('range'), [new WNumber(1), x]);
			error('No compile function of ^ for ' + x);
		}
	};
	op['~'] = {
		length: 1,
		compile: function() {}
	};
	op["'"] = {
		compile: function(a, b) {return a.addMeta(b)}
	};
	op["''"] = {
		compile: function(a, b) {return a}
	};
	op[';'] = {
		compile: function() {}
	};

	function normalizeOps() {
		for(var k in op) {
			var o = op[k];
			if(!o.compile) error('Operator ' + k + ' does not have a compile function');
			if(undef(o.length)) o.length = typeof o.compile == 'string'? 1: o.compile.length;
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
						eval(Wortel.toJs(s));
					else console.log(Wortel.toJs(s));
				});
			}
		}
	}
}
