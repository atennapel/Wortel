/* Miro
 * @author: Albert ten Napel
 *
 * TODO:
 * 	-> @_
 */
var Miro = (function() {
	// TEMP
	Array.prototype.toString = function() {return '@[' + this.join(' ') + ']'};
	//

	var version = '0.3.1';

	var nameoperator = '@';
	var brackets = '()[]{}<>';
	var symbols = '~`!@#%^&*-+=|\\:;/?.,<>';
	var escaped = {'\b': 'b','\f': 'f', '\n': 'n', '\0': '0', '\r': 'r', '\v': 'v', '\t': 't'};
	function matchingBracket(c) {
		var t = brackets.indexOf(c);
		if(t == -1) return null;
		return brackets[t%2? t-1: t+1];
	}
	function pushAll(to, a) {for(var i = 0, l = a.length; i < l; i++) to.push(a[i]); return to}
	function last(a) {return a[a.length-1]}
	function isDigit(c) {return /[0-9]/g.test(c)}
	function isSymbol(c) {return ~symbols.indexOf(c)}
	function isName(c) {return /[a-z_\$]/gi.test(c)}
	function isWhitespace(c) {return /\s/.test(c)}
	function nextPart(s, i, n) {return s.slice(i, i+n)}
	function splitOp(o) {
		for(var i = 0, l = o.length, r = []; i < l; i++) {
			var c = o.slice(i);
			if(ops[c]) {
				if(i > 0)
					pushAll(r, splitOp(o.slice(0, i)));
				return r.push(new expr.Symbol(c)), r;
			} else if(c.length == 1)
				synerror('Undefined operator: ' + c);
		}
	}
	function parse(s) {
		var	_ = 0, START = _++, NUMBER = _++, NAME = _++, STRING = _++;
		var OPERATOR = _++, NAMEOPERATOR = _++, SQ = _++, REGEXP = _++;
		var SQBOPEN = _++, SQMIDDLE = _++, SQNAME = _++;
		var COMMENT = _++, COMMENTBOPEN = _++, COMMENTMIDDLE = _++;
		var COMMENTLINE = _++, REGEXPT = _++;
		var state = START, j = 0, p = [], r = [], t = [], tt = [], tmp = null;
		var b = [], br = null, esc = false, rx = false;
		for(var i = 0, l = s.length; i <= l; i++) {
			var c = s[i] || ' ';
			if(state == START) {
				if(c == '"') state = STRING;
				else if(c == "'" && i > 0 && !isWhitespace(s[i-1]) &&
					!(r[r.length-1] instanceof expr.List) && '([{'.indexOf(s[i-1]) == -1) r.push(new expr.Symbol("'"));
				else if(c == "'") state = SQ;
				else if(nextPart(s, i, 2) == ';;') i++, state = COMMENT;
				else if(c == '(' || c == '[' || c == '{') {
					var last = r[r.length-1];
					if(i > 0 && !isWhitespace(s[i-1]) && '([{'.indexOf(s[i-1]) == -1 &&
					(!(last instanceof expr.Symbol) || (last instanceof expr.Symbol && last.op.namelike))) r.push(new expr.Symbol(
						c == '('? '$apply':
						c == '['? '$index':
						c == '{'? '$smartindex': synerror('Invalid bracket: ' + c)
					));
					b.push(matchingBracket(c)), p.push(r), r = [];
				}
				else if(c == ')' || c == ']' || c == '}') {
					if(c != b[b.length-1]) synerror('Closing bracket before opening: ' + c);
					var a = r;
					r = p.pop();
					r.push(new expr[
						c == ')'? 'Group':
						c == ']'? 'Array':
						c == '}'? 'Object': synerror('Invalid bracket: ' + c)
					](parseOp(a)));
					b.pop();
				}
				else if(isDigit(c)) t.push(c), state = NUMBER;
				else if(isName(c)) t.push(c), state = NAME;
				else if(isSymbol(c)) i--, state = OPERATOR;
			}
			else if(state == NUMBER) {
				if(!isDigit(c) && !isName(c) && c != '.')
					r.push(new expr.Number(t.join(''))), t = [], i--, state = START;
				else t.push(c);
			}
			else if(state == NAME) {
				if(!isDigit(c) && !isName(c))
					r.push(new expr.Name(t.join(''))), t = [], i--, state = START;
				else t.push(c);
			}
			else if(state == STRING) {
				if(esc) t.push(c), esc = false;
				else if(c == '\\') t.push(c), esc = true;
				else if(escaped[c]) t.push('\\', escaped[c]);
				else if(c == '"')
					r.push(new expr.String(t.join(''))), t = [], state = START;
				else t.push(c);
			}
			else if(state == OPERATOR) {
				if(c == nameoperator && isName(s[i+1])) {
					if(t.length > 0) pushAll(r, splitOp(t.join('')));
					t = [c], state = NAMEOPERATOR;
				} else if(!isSymbol(c)) {
					pushAll(r, splitOp(t.join('')));
					t = [];
					state = START, i--;
				} else t.push(c);
			}
			else if(state == NAMEOPERATOR) {
				if(!isName(c) && !isDigit(c)) {
					var name = t.join('');
					r.push(namelike[name] || new expr.Symbol(name));
					t = [];
					state = START, i--;
				} else t.push(c);
			}
			else if(state == SQ) {
				if(c == '/') state = REGEXP;
				else if(c == '[' || c == '{' || c == '(' || c == '<') t.unshift(matchingBracket(c)), state = SQBOPEN;
				else i--, state = SQNAME;
			}
			else if(state == SQBOPEN) {
				if(c == '[' || c == '{' || c == '(' || c == '<') t.unshift(matchingBracket(c));
				else br = t.join(''), t = [], i--, state = SQMIDDLE;
			}
			else if(state == SQMIDDLE) {
				if(c == br[j]) {
					t.push(c), j++;
					if(!br[j])
						r.push(new expr.String(t.slice(0, -br.length).join(''))), br = null, j = 0, t = [], state = START;
				} else if(escaped[c]) t.push('\\', escaped[c]);
				else t.push(c);
			}
			else if(state == SQNAME) {
				if(isWhitespace(c) || '()[]{}'.indexOf(c) > -1)
					r.push(new expr.String(t.join(''))), t = [], i--, state = START;
				else t.push(c);
			}
			else if(state == COMMENT) {
				if(c == '[' || c == '{' || c == '(' || c == '<') tt.unshift(matchingBracket(c)), state = COMMENTBOPEN;
				else state = COMMENTLINE;
			}
			else if(state == COMMENTLINE) {
				if(c == '\n') state = rx? (rx = false, REGEXP): START;
			}
			else if(state == COMMENTBOPEN) {
				if(c == '[' || c == '{' || c == '(' || c == '<') tt.unshift(matchingBracket(c));
				else br = tt.join(''), tt = [], i--, state = COMMENTMIDDLE;
			}
			else if(state == COMMENTMIDDLE) {
				if(c == br[j]) {
					j++;
					if(!br[j]) br = null, j = 0, state = rx? (rx = false, REGEXP): START;
				}
			}
			else if(state == REGEXP) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') esc = true, t.push(c);
				else if(c == '/') tmp = t.join(''), t = [], state = REGEXPT;
				else if(nextPart(s, i, 2) == ';;') i++, state = COMMENT, rx = true;
				else if(escaped[c]) t.push('\\', escaped[c]);
				else if(c != '\n' && c != '\r') t.push(c);
			}
			else if(state == REGEXPT) {
				if(!isName(c)) {
					r.push(new expr.RegExp(tmp, t.join('')));
					t = [], i--, state = START;
				} else t.push(c);
			}
		}
		if(state != START) synerror('Unclosed');
		return parseOp(r);
	}

	function parseOp(a) {
		var r = a.slice();
		var o = r.filter(function(x) {return x instanceof expr.Symbol}).sort(function(a, b) {return a.op.precr < b.op.precl});
		for(var i = 0, l = o.length; i < l; i++) {
			var op = o[i], j = r.indexOf(op), s = op.op.style, args = [], sp = 0;
			if(s == 'infix') {
				var sp = j - 1, p = 1;
				if(!r[j - 1] || r[j - 1] instanceof expr.Symbol) args.push(op.op.nopapfirst? tempexpr: placeholder), sp = j;
				else args.push(r[j - 1]), p++;
				if(!r[j + 1] || r[j + 1] instanceof expr.Symbol) args.push(op.op.nopapsecond? tempexpr: placeholder);
				else args.push(r[j + 1]), p++;
				r.splice(sp, p, new expr.Call(op, args));
			} else if(s == 'prefix') {
				if(!r[j + 1] || r[j + 1] instanceof expr.Symbol) args.push(op.op.nopapfirst? tempexpr: placeholder), sp++;
				else args.push(r[j + 1]);
				r.splice(j, 2 - sp, new expr.Call(op, args));
			} else if(s == 'nofix') {
				r.splice(j, 1, new expr.Call(op, []));
			} else error('Invalid operator style: ' + s);
		}
		return r;
	}

	function mCompile(a) {return a.compile()}
	function mOptimize(a) {return a.optimize()}
	function compile(s) {
		var p = parse(s);
		var o = optimize(p);
		var c = o.map(mCompile);
		return c.join('; ');
	}
	function optimize(a) {
		var p = null, c = a, cs;
		while((c = c.map(mOptimize), cs = c.join(' ')) !== p) p = cs;
		return c;
	}

	function synerror(s) {
		throw SyntaxError(s);
	}

	function error(s) {
		throw Error(s);
	}

	// objects
	function unpack(v) {
		return Array.isArray(v)? v: v instanceof expr.Array || v instanceof expr.Group || v instanceof expr.Object? v.val: [v];
	}
	
	var expr = {};
	function extend(obj, f, o) {
		var name = f.name;
		expr[name] = f;
		if(obj) f.prototype = Object.create(obj.prototype);
		if(o) for(var m in o) f.prototype[m] = o[m];
		return f;
	}

	extend(null, function Expr() {}, {
		toString: function() {return 'Expr'},
		optimize: function() {return this},
		compile: function() {return this.toString()},
		addMeta: function(v) {this.meta = this.meta || []; this.meta.push(v); return this},
		countPlaceholders: function() {return 0},
		or: function() {return this},
		temp: function() {return false},
		replacePlaceholder: function() {return this}
	});

	extend(expr.Expr, function Number(v) {
		this.val = v;
	}, {
		toString: function() {return this.val}
	});

	extend(expr.Expr, function Name(v) {
		this.val = v;
	}, {
		toString: function() {return this.val},
		countPlaceholders: function() {return +(this === placeholder)},
		replacePlaceholder: function(state) {
			if(this === placeholder) {
				var n = uname();
				state.push(n);
				return n;
			}
			return this;
		}
	});
	var placeholder = new expr.Name('@_');
	var tempexpr = new expr.Name('@TEMP');
	tempexpr.or = function(x) {return x};
	tempexpr.temp = function() {return true};
	var _n = 0;
	function uname() {return new expr.Name('_' + (_n++).toString(36))}

	extend(expr.Expr, function String(v) {
		this.val = v;
	}, {
		toString: function() {return '"' + this.val + '"'},
	});

	extend(expr.Expr, function RegExp(v, m) {
		this.val = v;
		this.mod = m;
	}, {
		toString: function() {return '/' + this.val + '/' + this.mod},
	});

	extend(expr.Expr, function List(v) {
		this.val = v;
	}, {
		toString: function() {return 'List'},
		countPlaceholders: function() {
			for(var i = 0, n = 0, a = this.val, l = a.length; i < l; i++)
				n += a[i].countPlaceholders();
			return n;
		}
	});

	extend(expr.List, function Array(v) {
		this.val = v;
	}, {
		toString: function() {return '[' + this.val.join(' ') + ']'},
		optimize: function() {return new expr.Array(this.val.map(mOptimize))},
		compile: function() {return '[' + this.val.map(mCompile).join(', ') + ']'},
		replacePlaceholder: function(state) {
			return new expr.Array(this.val.map(function(x) {return x.replacePlaceholder(state)}));
		}
	});

	extend(expr.List, function Object(v) {
		this.val = v;
	}, {
		toString: function() {return '{' + this.val.join(' ') + '}'},
		optimize: function() {return new expr.Object(this.val.map(mOptimize))},
		compile: function() {
			var a = this.val.map(mCompile), r = [];
			for(var i = 0, l = a.length; i < l; i += 2)
				r.push(a[i] + ': ' + a[i+1]);
			return '{' + r.join(', ') + '}';
		},
		replacePlaceholder: function(state) {
			return new expr.Object(this.val.map(function(x) {return x.replacePlaceholder(state)}));
		}
	});

	extend(expr.List, function Group(v) {
		this.val = v;
	}, {
		toString: function() {return '(' + this.val.join(' ') + ')'},
		optimize: function() {
			var l = this.val.length;
			//if(l == 1) return this.val[0];
			return new expr.Group(this.val.map(mOptimize));
		},
		compile: function() {return '(' + this.val.map(mCompile).join(', ') + ')'},
		replacePlaceholder: function(state) {
			return new expr.Group(this.val.map(function(x) {return x.replacePlaceholder(state)}));
		}
	});

	extend(expr.Expr, function Symbol(v) {
		this.val = v;
		this.op = ops[v];
		if(!this.op) synerror('Undefined operator: ' + v);
	}, {
		toString: function() {return this.val}
	});

	extend(expr.List, function Call(f, v) {
		this.fn = f;
		this.val = unpack(v);
	}, {
		toString: function() {return '(' + this.fn + ' ' + this.val.join(' ') + ')'},
		optimize: function() {
			if(this.fn === placeholder || this.fn instanceof expr.Partial || containsPartial(this.val) || containsPlaceholder(this.val))
				return new expr.Partial(this.fn, this.val);
			if(this.fn instanceof expr.Symbol && this.fn.op.compile)
				return this.fn.op.compile.apply(this.fn, this.val.map(mOptimize));
			return new expr.Call(this.fn, this.val.map(mOptimize));
		},
		compile: function() {
			if(this.fn instanceof expr.Symbol) {
				var o = this.fn.op, op = o.operator;
				if(o.style == 'infix')
					return '(' + this.val[0].compile() + ' ' + op + ' ' + this.val[1].compile() + ')';
				else if(o.style == 'prefix')
					return '(' + op + ' ' + this.val[0].compile() + ')';
				else if(o.style == 'nofix')
					return '(' + op + ')';
				else error('Invalid operator style: ' + o.style);
			}
			return this.fn.compile() + '(' + this.val.map(mCompile).join(', ') + ')';
		},
		countPlaceholders: function() {
			for(var i = 0, n = 0, a = this.val, l = a.length; i < l; i++)
				n += a[i].countPlaceholders();
			n += this.fn.countPlaceholders();
			return n;
		},
		replacePlaceholder: function(state) {
			return new expr.Call(
				this.fn.replacePlaceholder(state),
				this.val.map(function(x) {return x.replacePlaceholder(state)})
			);
		}
	});

	function containsPlaceholder(a) {
		for(var i = 0, l = a.length; i < l; i++)
			if(a[i] === placeholder)
				return true;
		return false;
	}
	function containsPartial(a) {
		for(var i = 0, l = a.length; i < l; i++)
			if(a[i] instanceof expr.Partial)
				return true;
		return false;
	}
	extend(expr.Call, function Partial(f, v) {
		this.fn = f;
		this.val = unpack(v);
	}, {
		toString: function() {return '{' + this.fn + ' ' + this.val.join(' ') + '}'},
		optimize: function() {
			var args = [], body = this.replacePlaceholder(args);
			return new expr.Fn(args, body);
		},
		replacePlaceholder: function(state) {
			return new expr.Call(
				this.fn.replacePlaceholder(state),
				this.val.map(function(x) {return x.replacePlaceholder(state)})
			);
		}
	});

	extend(expr.Expr, function Fn(args, body) {
		this.args = unpack(args);
		this.body = unpack(body);
	}, {
		toString: function() {return '(' + this.args.join(', ') + ') -> (' + this.body.join(', ') + ')'},	
		optimize: function() {
			return new expr.Fn(this.args.map(mOptimize), this.body.map(mOptimize));
		},
		compile: function() {
			var last = this.body[this.body.length-1].compile();
			var head = this.body.slice(0, -1).map(mCompile);
			return 'function(' + this.args.map(mCompile).join(', ') + ') {' + head.join(';') + '; return (' + last + ')}';
		},
		countPlaceholders: function() {
			var n = 0;
			for(var i = 0, a = this.args, l = a.length; i < l; i++)
				n += a[i].countPlaceholders();
			for(var i = 0, a = this.body, l = a.length; i < l; i++)
				n += a[i].countPlaceholders();
			return n;
		},
		replacePlaceholder: function(state) {
			return new expr.Fn(
				this.args.map(function(x) {return x.replacePlaceholder(state)}),
				this.body.map(function(x) {return x.replacePlaceholder(state)})
			);
		}
	});

	extend(expr.Expr, function Prop(a, b) {
		this.a = a;
		this.b = b;
	}, {
		toString: function() {return this.a + '.' + this.b},
		optimize: function() {return new expr.Prop(this.a.optimize(), this.b.optimize())},
		compile: function() {return '(' + this.a.compile() + ').' + this.b.compile()},
		countPlaceholders: function() {return this.a.countPlaceholders() + this.b.countPlaceholders()},
		replacePlaceholder: function(a) {return new expr.Prop(this.a.replacePlaceholder(a), this.b.replacePlaceholder(a))}
	});

	// operators
	var namelike = {
		'@_': placeholder
	};
	var ops = {
		'+': {
			precl: 4,
			precr: 4,
			style: 'infix',
			operator: '+'
		},
		'*': {
			precl: 5,
			precr: 6,
			style: 'infix',
			operator: '*'
		},
		'-': {
			precl: 4,
			precr: 4,
			style: 'infix',
			operator: '-'
		},
		'/': {
			precl: 5,
			precr: 6,
			style: 'infix',
			operator: '/'
		},
		'%': {
			precl: 5,
			precr: 6,
			style: 'infix',
			operator: '%'
		},
		'@+': {
			precl: 11,
			precr: 10,
			style: 'prefix',
			operator: '+'
		},
		'@-': {
			precl: 11,
			precr: 10,
			style: 'prefix',
			operator: '-'
		},
		"'": {
			precl: 200,
			precr: 200,
			style: 'infix',
			compile: function(a, b) {return a.addMeta(b)}
		},
		'.': {
			precl: 150,
			precr: 150,
			style: 'infix',
			compile: function(a, b) {return new expr.Prop(a, b)}
		},
		'$index': {
			precl: 150,
			precr: 150,
			style: 'infix'
		},
		'$smartindex': {
			precl: 150,
			precr: 150,
			style: 'infix'
		},
		'$apply': {
			precl: 150,
			precr: 150,
			style: 'infix',
			compile: function(f, a) {
				return new expr.Call(f, a);
			}
		},
		':': {
			precl: 2,
			precr: 1,
			style: 'infix',
			operator: '='
		},
		'::': {
			precl: 15,
			precr: 15,
			style: 'infix',
			compile: function(a, b) {
				return new expr.Call(new expr.Name('type'), [a, b]);
			}
		},
		'::?': {
			precl: 15,
			precr: 15,
			style: 'infix',
			compile: function(a, b) {
				return new expr.Call(new expr.Name('isType'), [a, b]);
			}
		},
		'->': {
			precl: 3,
			precr: 2,
			nopapfirst: true,
			style: 'infix',
			compile: function(a, b) {
				return new expr.Fn(a.or([]), b);
			}
		},
		'=>': {
			precl: 3,
			precr: 2,
			nopapfirst: true,
			style: 'infix',
			compile: function(a, b) {
				return new expr.Call(
					new expr.Prop(
						new expr.Fn(a.or([]), b),
						new expr.Name('bind')
					),
					[
						new expr.Name('this')
					]
				);
			}
		},
		';': {
			precl: 999,
			precr: 999,
			style: 'prefix',
			compile: function(a) {return a}
		},
		'=': {
			precl: 3,
			precr: 3,
			style: 'infix',
			operator: '==='
		},
		'&': {
			precl: 2,
			precr: 2,
			style: 'infix',
			operator: '&&'
		},
		'|': {
			precl: 2,
			precr: 2,
			style: 'infix',
			operator: '||'
		}
	};

	function formatValue(x) {
		var t = typeof x;
		if((x instanceof Number || t == 'number') ||
			 (x instanceof Date) || (x === undefined) || (x === null) || (t == 'boolean') || (t == 'function'))
			return ''+x;
		if(x instanceof String || t == 'string')
			return JSON.stringify(x);
		if(Array.isArray(x)) {
			for(var i = 0, l = x.length, r = []; i < l; i++)
				r.push(_str(x[i]));
			if(r[0][0] == '[')
				return '[\n' + r.join('\n') + '\n]';
			else
				return '[' + r.join(' ') + ']';
		}
		var r = [];
		for(var k in x)
			r.push(_str(k), _str(x[k]));
		return '{' + r.join(' ') + '}';
	};

	function runTags() {
		for(var i = 0, a = document.getElementsByTagName('script'), l = a.length; i < l; i++)
			if(a[i].type.toLowerCase() == 'text/wortel')
				eval(compile(a[i].innerHTML))
	};
	
	return {
		compile: compile,
		version: version,
		formatValue: formatValue,
		runTags: runTags
	};
})();

if(typeof global != 'undefined' && global) {
	// Export
	if(module && module.exports) module.exports = Miro;
	// Commandline
	if(require.main === module) {
		var args = process.argv.slice(2), l = args.length;
		if(l === 0) {
			var readline = require('readline').createInterface(process.stdin, process.stdout);
			// REPL
			var PARSEMODE = 0, EVALMODE = 1;
			var INITIALMODE = PARSEMODE;
			var INITIALFORMAT = true;
			var INITIALSTR = true;
			
			var mode = INITIALMODE, format = INITIALFORMAT, str = INITIALSTR;
			console.log('Miro '+Miro.version+' REPL');
			process.stdin.setEncoding('utf8');
			function input() {
				readline.question('> ', function(s) {
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
							if(format) t = Miro.formatValue(t);
							console.log(t);
						} else if(mode == EVALMODE) {
							var t = eval(Miro.compile(s));
							if(format) t = Miro.formatValue(t);
							console.log(t);
						}
					} catch(e) {
						console.log('Error: '+e);
					}
					setTimeout(input(), 0);
				});
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
