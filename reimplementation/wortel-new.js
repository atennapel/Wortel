/* Wortel compiler
 * @version: 0.1
 * @author: Albert ten Napel
 * @email: aptennap@gmail.com
 * @github: atennapel
 * @date: 2014-08-30
 */
var Wortel = (function() {
	var version = '0.1';

	var BRACKETS = '()[]{}';
	var INFIX_OPS = ["'", '.', '..', '^..', '..^', '^..^'];
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
	function isIdent(c) {return /[a-z_\$]/i.test(c)}
	function isSymbol(c) {return '`~!@#%^&*-+=|\\;:/?><,'.indexOf(c) > -1}
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
				else if(nextPart(s, i, 4) == '^..^')
					i += 3, r.push({type: 'operator', val: '^..^'});
				else if(nextPart(s, i, 3) == '..^')
					i += 2, r.push({type: 'operator', val: '..^'});
				else if(nextPart(s, i, 2) == '..')
					i++, r.push({type: 'operator', val: '..'});
				else if(nextPart(s, i, 3) == '^..')
					i += 2, r.push({type: 'operator', val: '^..'});
				else if(c == '.') r.push({type: 'operator', val: '.'});
				else if(c == "'" && i > 0 && !isWhitespace(s[i-1]))
					r.push({type: 'operator', val: "'"});
				else if(c == "'") state = QF;
				else if(nextPart(s, i, 2) == ';;') i++, state = COMMENT;
				else if(isOpeningBracket(c))
					r.push({type: 'open', val: c, whitespace: isWhitespace(s[i-1])});
				else if(isClosingBracket(c))
					r.push({type: 'close', val: otherBracket(c)});
				else if(isDigit(c)) state = NUMBER, i--;
				else if(isIdent(c)) state = NAME, i--;
				else if(isSymbol(c)) state = OPERATOR, i--;
			} else if(state == NUMBER) {
				if(!isDigit(c) && !isIdent(c) && c != '.') {
					r.push({type: 'number', val: t.join('')});
					t = [];
					state = START, i--;
				} else if(nextPart(s, i, 2) == '..') {
					r.push({type: 'number', val: t.join('')});
					t = [];
					state = START, i--;
				} else t.push(c);
			} else if(state == NAME) {
				if(!isDigit(c) && !isIdent(c)) {
					r.push({type: 'name', val: t.join('')});
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
				if(isWhitespace(c))
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
				else if(ty == 'number')
					r.push(new WNumber(v));
				else if(ty == 'name')
					r.push(new WName(v));
				else if(ty == 'string')
					r.push(new WString(v));
				else if(ty == 'regexp')
					r.push(new WRegExp(v, c.flags));
				else if(ty == 'operator')
					r.push(new WSymbol(v));
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
			var c = r[i];
			if(c instanceof WSymbol && INFIX_OPS.indexOf(c.val) > -1) {
				if(i == 0) c.reversed = true;
				else {
					var t = r[i-1];
					r[i-1] = c, r[i] = t;
				}
			}
		}
	
		return getArgs(r);
	}

	function getArgs(a) {
		// Handle reversing operator
		for(var i = 0, l = a.length; i < l; i++) {
			var c = a[i], n = a[i+1];
			if(c instanceof WSymbol && c.val == '~' && n instanceof WSymbol) {
				n.reversed = true;
				a.splice(i, 1), i--;
			}
		}

		// getArgs
		for(var i = a.length-1, s = []; i >= 0; i--)
			a[i].getArgs(s);

		return s;
	}
	
	function compile(s) {
		return toAST(tokenize(s));
	}

	// Expr
	function WExpr(val) {};
	WExpr.prototype.toString = function() {return 'WExpr'};
	WExpr.prototype.getArgs = function(s) {s.push(this)};

	// Number
	function WNumber(n) {
		this.val = n;
	};
	extend(WNumber, WExpr);
	WNumber.prototype.toString = function() {return this.val};

	// Name
	function WName(n) {
		this.val = n;
	};
	extend(WName, WExpr);
	WName.prototype.toString = function() {return this.val};

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
	};
	extend(WSymbol, WExpr);
	WSymbol.prototype.toString = function() {
		return (this.reversed? '~': '') + this.val;
	};
	WSymbol.prototype.getArgs = function(s) {
		var l = op[this.val].length;
		for(var i = Math.min(l, s.length), args = []; i > 0; i--)
			args.push(s.pop());
		if(args.length < l)
			s.push(new WOpPartial(this, args));
		else
			s.push(new WOpCall(this, args));
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
	
	// Group
	function WGroup(a, w) {
		this.val = a;
		this.whitespace = w;
	};
	extend(WGroup, WList);
	WGroup.prototype.toString = function() {
		return '(' + this.val.join(' ') + ')';
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
		this.op = op[fn];
	};
	extend(WOpCall, WCall);

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
		this.op = op[fn];
	};
	extend(WOpPartial, WPartial);
	
	// operators
	var op = {};

	op['+'] = {
		length: 2
	};
	op['-'] = {
		length: 2
	};
	op['~'] = {
		length: 1
	};

	op["'"] = {
		length: 2
	};
	op['.'] = {
		length: 2
	};
	op['..'] = {
		length: 2
	};
	op['^..'] = {
		length: 2
	};
	op['..^'] = {
		length: 2
	};
	op['^..^'] = {
		length: 2
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
