/*
	Apfelkorn compiler
	@author: Albert ten Napel
	@version: 2013-9-2

	TODO: for, while, (JS statements maybe?),
				fix groups in fns and lets,
				exprs in strings,
				pragmas and includes,
				match,
				regex,
				double suffix
*/
var Parser = require('./Parser'),
		compileNumber = require('./compileNumber'),
		compileName = require('./compileName'),
		Escodegen = require('escodegen'),
		Esprima = require('esprima'),
		escOptions = {
			format: {
				indent: {
					style: '  '
				}
			}
		};

// tokenlist -> Apfelkorn AST
var toApfelkornAST = function(tokens) {
	var r = [],
			t = [].concat(tokens),
			next = t.shift.bind(t),
			f = false,
			b = false,
			sfx = false,
			d = false,
			dd = false,
			args = [],
			c;

	t.forEach(function(c) {
		if(c.type == 'list' || c.type == 'group' || c.type == 'object')
			c.val = toApfelkornAST(c.val);
	});

	while(c = next()) {
		if(b) {
			args.push({type: 'lambda', arg: b, body: c});
			b = false;
		} else if(sfx) { // index
			args.push({type: 'suffix', val: sfx, suffix: c});
			sfx = false;
		} else if(d) { // chain
			args.push({type: 'chain', a: d, b: c});
			d = false;
		} else if(dd) { // fn
			args.push({type: 'prop', val: c});
			dd = false;
		} else if(c.type == 'colon') { // :
			var temp = args.pop();
			if(f) {
				args = [{type: 'call', fn: f, args: args}];
				f = false;
			}
			f = temp;
		} else if(c.type == 'backtick') { // `
			sfx = args.pop();
		} else if(c.type == 'comma') { // ,
			if(f) {
				args = [{type: 'call', fn: f, args: args}];
				f = false;
			}
		} else if(c.type == 'semicolon') { // ;
			if(f) {
				args = [{type: 'call', fn: f, args: args}];
				f = false;
			}
			r = r.concat(args);
			args = [];
		} else if(c.type == 'backslash') { // \
			b = args.pop();
		} else if(c.type == 'dot') { // .
			if(f) {
				args = [{type: 'call', fn: f, args: args}];
				f = false;
			}
			d = args.pop();
		} else if(c.type == 'dotdot') { // ..
			dd = true;
		} else if(c.type != 'comment') { // literal
			args.push(c);
		}
	}

	if(f) args = [{type: 'call', fn: f, args: args}];
	
	return r.concat(args);
};

var exprToStatement = function(x) {
	switch(x.type) {
		case 'VariableDeclaration':
			return x;
	}
	return {
		type: 'ExpressionStatement',
		expression: x
	};
};

var compileList = function(x) {
	return {
		type: 'ArrayExpression',
		elements: x.val.map(partToJsAstExpr)
	};
};

var compileObject = function(x) {
	for(var i=0,r=[];i<x.val.length;i+=2)
		r.push({key: partToJsAstExpr(x.val[i]), value: partToJsAstExpr(x.val[i+1]), kind: 'init'});
	return {
		type: 'ObjectExpression',
		properties: r
	};
};

var compileGroup = function(x) {
	if(x.val.length === 0) return {type: 'Identifier', name: 'undefined'};
	if(x.val.length == 1) return partToJsAstExpr(x.val[0]);
	
	var init = x.val.slice(0,-1).map(partToJsAstStatement);
	var last = {
		type: 'ReturnStatement',
		argument: partToJsAstExpr(x.val[x.val.length-1])
	};

	return {
		type: 'CallExpression',
		callee: {
			type: 'FunctionExpression',
			id: null,
			params: [],
			defaults: [],
			rest: null,
			body: {
				type: 'BlockStatement',
				body: init.concat([last])
			},
			generator: false,
			expression: false
		},
		arguments: []
	}
};

var compileString = function(s) {
	return {type: 'Literal', value: s.val};
};

var compileLambda = function(l) {
	var args, id = null;
	if(l.arg.type == 'object') {
		args = l.arg.val.slice(1);
		id = partToJsAstExpr(l.arg.val[0])
	} else args = (l.arg.type == 'list'? l.arg.val: [l.arg]);

	var cont;
	for(var i=args.length-1;i>=0;i--) {
		if(args[i].type == 'name' && args[i].symbol && args[i].val == '&') {
			cont = i;
			break;
		}
	}

	args = args.map(partToJsAstExpr);

	if(typeof cont == 'number') {
		var init = args.slice(0, cont), rest = args.slice(cont+1)[0];
		return {
			type: 'FunctionExpression',
			id: id,
			params: init,
			defaults: [],
			rest: null,
			body: {
				type: 'BlockStatement',
				body: [{
					type: 'VariableDeclaration',
					declarations: [{
						type: 'VariableDeclarator',
						id: rest,
						init: Esprima.parse('Array.prototype.slice.call(arguments,'+cont+')').body[0].expression	
					}],
					kind: 'var'
				},{
					type: 'ReturnStatement',
					argument: partToJsAstExpr(l.body)
				}]
			},
			generator: false,
			expression: false
		};
	} return { 
		type: 'FunctionExpression',
		id: id,
		params: args,
		defaults: [],
		rest: null,
		body: {
			type: 'BlockStatement',
			body: [{
				type: 'ReturnStatement',
				argument: partToJsAstExpr(l.body)
			}]
		},
		generator: false,
		expression: false
	};
};

var createProp = function(x) {
	var t = partToJsAstExpr(x);
	if(t.type != 'MemberExpression' && t.type != 'CallExpression')
		return { 
			type: 'FunctionExpression',
			id: null,
			params: [{type: 'Identifier', name: 'x'}],
			defaults: [],
			rest: null,
			body: {
				type: 'BlockStatement',
				body: [{
					type: 'ReturnStatement',
					argument: {
						type: 'MemberExpression',
						object: {type: 'Identifier', name: 'x'},
						property: t,
						computed: x.type != 'name'
					}
				}]
			},
			generator: false,
			expression: false
		};
	else {
		var c = Escodegen.generate(t, escOptions);
		if(/[0-9]/.test(c[0])) {
			var r = c.split(''), tr = [], tc;
			while(/[0-9]/.test(tc = r.shift())) tr.push(tc);
			var num = tr.join(''), rest = r.join('');
			c = 'x['+num+']'+rest;
		} else c = 'x.'+c;
		c = Esprima.parse(c).body[0].expression;
		return { 
			type: 'FunctionExpression',
			id: null,
			params: [{type: 'Identifier', name: 'x'}],
			defaults: [],
			rest: null,
			body: {
				type: 'BlockStatement',
				body: [{
					type: 'ReturnStatement',
					argument: c
				}]
			},
			generator: false,
			expression: false
		};
	}
};

var createCallExpression = function(f, args) {
	var args = Array.isArray(args)? args: [args];
	return {
		type: 'CallExpression',
		callee: typeof f == 'string'? {type: 'Identifier', name: f}: f, 
		arguments: args
	};
};

var suffixes = {
	'*': function(expr) {return createCallExpression('map', expr)},
	'-': function(expr) {return createCallExpression('filter', expr)},
	'/': function(expr) {return createCallExpression('reduce', expr)},
	'~': function(expr) {return createCallExpression('revargs', expr)},
	'%': function(expr) {return createCallExpression('reflex', expr)},
	'!': function(expr) {return createCallExpression('apply', expr)},
	'@': function(expr) {return createCallExpression('mapcf', expr)},
};

var compileSuffix = function(v, s) {
	if(s.type == 'name' && s.symbol) {
		var sfx = s.val.split('');
		var c = partToJsAstExpr(v);
		for(var i=0,l=sfx.length;i<l;i++)
			if(suffixes[sfx[i]]) c = suffixes[sfx[i]](c);
			else throw('Unknown suffix: '+sfx[i]);
		return c;
	} else return createCallExpression('curryr', [partToJsAstExpr(v), partToJsAstExpr(s)]);
};

var createBinaryExpression = function(op, args) {
	var args = Array.prototype.slice.call(args)
						 .map(function(x) {return x.type == 'list'? x.val: [x]})
						 .reduce(function(x, y) {return x.concat(y)})
						 .map(partToJsAstExpr);
	var createBin = function(a, b) {
		return {
			type: 'BinaryExpression',
			operator: op,
			left: a,
			right: b
		};
	}
	var c = createBin(args[0], args[1]);
	for(var i=2;i<args.length;i++) {
		c = createBin(c, args[i]);
	}
	return c;
};

var createBinaryExpressionWithLJoin = function(op, j, args) {
	var arr = Array.prototype.slice.call(args).map(partToJsAstExpr);
	var r = [];
	for(var i = 0, l = arr.length; i < l; i++) {
		var a = arr[i], b = arr[i+1];
		if(!b) break;
		r.push({type: 'BinaryExpression', operator: op, left: a, right: b});
	}
	if(r.length == 1) return r[0];
	return r.reduceRight(function(a, b) {
		if(!a.right) a.right = b;
		else if(!a.left) a.left = b;
		else return {
			type: 'LogicalExpression',
			operator: j,
			left: b,
			right: a
		};
		return a;
	}, {type: 'LogicalExpression', operator: j});
};

var createLogicalJoin = function(j, args) {
	var r = Array.prototype.slice.call(args).map(partToJsAstExpr);
	if(r.length == 1) return r[0];
	return r.reduceRight(function(a, b) {
		if(!a.right) a.right = b;
		else if(!a.left) a.left = b;
		else return {
			type: 'LogicalExpression',
			operator: j,
			left: b,
			right: a
		};
		return a;
	}, {type: 'LogicalExpression', operator: j});
};

var macros = {
	'new': function(o) {
		var args = [].slice.call(arguments, 1).map(partToJsAstExpr);
		return {
			type: 'NewExpression',
			callee: partToJsAstExpr(o),
			arguments: args
		};
	},
	'+': function() {
		if(arguments.length == 1) return {
			type: 'UnaryExpression',
			operator: '+',
			prefix: true,
			argument: partToJsAstExpr(arguments[0])
		};
		return createBinaryExpression('+', arguments);
	},
	'-': function() {
		if(arguments.length == 1) return {
			type: 'UnaryExpression',
			operator: '-',
			prefix: true,
			argument: partToJsAstExpr(arguments[0])
		};
		return createBinaryExpression('-', arguments);
	},
	'*': function() {
		return createBinaryExpression('*', arguments);
	},
	'/': function() {
		return createBinaryExpression('/', arguments);
	},
	'%': function() {
		return createBinaryExpression('%', arguments);
	},
	'?': function() {
		if(arguments.length == 1 && arguments[0].type == 'object') {
			var a = arguments[0].val, l = a.length;
			if(l < 2) return {type: 'Identifier', name: 'undefined'};
			else if(l < 4) return {
				type: 'ConditionalExpression',
				test: partToJsAstExpr(a[0]),
				consequent: partToJsAstExpr(a[1]),
				alternate: l == 2? {type: 'Identifier', name: 'undefined'}: partToJsAstExpr(a[2])
			}; else {
				a = a.map(partToJsAstExpr);
				if(l % 2 === 0) a.push({type: 'Identifier', name: 'undefined'});
				return a.reduceRight(function(ter, val) {
					if(!ter.alternate) ter.alternate = val;
					else if(!ter.consequent) ter.consequent = val;
					else if(!ter.test) ter.test = val;
					else return {
						type: 'ConditionalExpression',
						alternate: ter,
						consequent: val
					};
					return ter;	
				}, {type: 'ConditionalExpression'});
			}
		}
		return macros['?']({type: 'object', val: Array.prototype.slice.call(arguments)});
	},
	'=': function() {
		return createBinaryExpressionWithLJoin('===', '&&', arguments);
	},
	'!=': function() {
		return createBinaryExpressionWithLJoin('!==', '&&', arguments);
	},
	'>': function() {
		return createBinaryExpressionWithLJoin('>', '&&', arguments);
	},
	'>=': function() {
		return createBinaryExpressionWithLJoin('>=', '&&', arguments);
	},
	'<': function() {
		return createBinaryExpressionWithLJoin('<', '&&', arguments);
	},
	'<=': function() {
		return createBinaryExpressionWithLJoin('<=', '&&', arguments);
	},
	'&&': function() {
		return createLogicalJoin('&&', arguments);
	},
	'||': function() {
		return createLogicalJoin('||', arguments);
	},
	'!': function(x) {
		return {
			type: 'UnaryExpression',
			operator: '!',
			prefix: true,
			argument: partToJsAstExpr(x)
		};
	},
	'&&!': function() {
		return {
			type: 'UnaryExpression',
			operator: '!',
			prefix: true,
			argument: (macros['&&'].apply(null, arguments))
		}
	},
	'||!': function() {
		return {
			type: 'UnaryExpression',
			operator: '!',
			prefix: true,
			argument: (macros['||'].apply(null, arguments))
		}
	},
	'is': function() {
		if(arguments.length == 1 && arguments[0].type == 'object') {
			var a = arguments[0].val, l = a.length, r = [];
			for(var i=0;i<l;i+=2) {
				var k = a[i], v = partToJsAstExpr(a[i+1]);
				if(k.type == 'list') {
					r.push.apply(r, k.val.map(function(k) {
						return {
							type: 'AssignmentExpression',
							operator: '=',
							left: partToJsAstExpr(k),
							right: v
						}	
					}));
				} else r.push({
					type: 'AssignmentExpression',
					operator: '=',
					left: partToJsAstExpr(k),
					right: v
				});
			}
			return {
				type: 'SequenceExpression',
				expressions: r
			};
		}
		return macros['is']({type: 'object', val: Array.prototype.slice.call(arguments)});
	},
	'var': function() {
		if(arguments.length == 1 && arguments[0].type == 'list') {
			return {
				type: 'VariableDeclaration',
				declarations: arguments[0].val.map(function(x) {return {type: 'VariableDeclarator', id: partToJsAstExpr(x), init: null}}),
				kind: 'var'
			};
		} else if(arguments.length == 1 && arguments[0].type == 'object') {
			var a = arguments[0].val, l = a.length, r = [];
			for(var i=0;i<l;i+=2) {
				var k = a[i], v = partToJsAstExpr(a[i+1]);
				if(k.type == 'list') {
					r.push.apply(r, k.val.map(function(k) {
						return {
							type: 'VariableDeclarator',
							id: partToJsAstExpr(k),
							init: v
						}	
					}));
				} else r.push({
					type: 'VariableDeclarator',
					id: partToJsAstExpr(k),
					init: v
				});
			}
			return {
				type: 'VariableDeclaration',
				declarations: r,
				kind: 'var'
			};
		}
		return macros['var']({type: 'object', val: Array.prototype.slice.call(arguments)});
	},
	'let': function(obj, expr) {
		var vars = macros['var'](obj), exprc = partToJsAstExpr(expr);
		return {
			type: 'CallExpression',
			callee: {
				type: 'FunctionExpression',
				id: null,
				params: [],
				defaults: [],
				rest: null,
				body: {
					type: 'BlockStatement',
					body: [vars, {
						type: 'ReturnStatement',
						argument: exprc
					}]
				},
				generator: false,
				expression: false
			},
			arguments: []
		};
	},
	'comment': function() {return ''}
};

macros['~='] = macros['is'];
macros['@='] = macros['var'];

var fnToTree = function(f) {return Esprima.parse('('+f+')').body[0].expression};

var reqFnsDef = {
	'__mod__': fnToTree(function(a, b) {
		return ((a%b)+b)%b;
	}),
	'__get__': fnToTree(function(c, i) {
		if(Array.isArray(i)) return i.map(function(x) {return __get__(c, x)});
		if(typeof i == 'number') return c[__mod__(i, c.length)];
		return c[i];
	}),
	'__fn__': fnToTree(function(f) {
		if(typeof f == 'function') return f;
		if(Array.isArray(f) || typeof f == 'object') return __get__.bind(null, f);
		return function() {return f};
	}),
	'__call__': fnToTree(function(f) {
		return __fn__(f).apply(null, Array.prototype.slice.call(arguments, 1));
	})
};
var reqFns = {};
var partToJsAstExpr = function(x) {
	if(x === undefined) return {type: 'Identifier', name: 'undefined'};
	var t = x.type;
	if(t == 'number') {
		return compileNumber(x);
	} else if(t == 'name') {
		return compileName(x);
	} else if(t == 'string') {
		return compileString(x);
	} else if(t == 'list') {
		return compileList(x);
	} else if(t == 'object') {
		return compileObject(x);
	} else if(t == 'group') {
		return compileGroup(x);
	} else if(t == 'lambda') {
		return compileLambda(x);
	} else if(t == 'call') {
		if(x.fn.type == 'name' && (!x.fn.parts || x.fn.parts.length === 0) && !x.fn.call && macros[x.fn.val]) return macros[x.fn.val].apply(null, x.args);

		// temp
		return {
			type: 'CallExpression',
			callee: partToJsAstExpr(x.fn),
			arguments: x.args.map(partToJsAstExpr)
		};
		// /temp

		reqFns.__fn__ = true;
		reqFns.__call__ = true;
		reqFns.__mod__ = true;
		reqFns.__get__ = true;
		return {
			type: 'CallExpression',
			callee: {type: 'Identifier', name: '__call__'},
			arguments: [partToJsAstExpr(x.fn)].concat(x.args.map(partToJsAstExpr))
		};
	} else if(t == 'chain') {
		return {
			type: 'MemberExpression',
			object: partToJsAstExpr(x.a),
			property: partToJsAstExpr(x.b),
			computed: x.b.type != 'name'
		};
	} else if(t == 'prop') {
		return createProp(x.val);
	} else if(t == 'suffix') {
		return compileSuffix(x.val, x.suffix);
	}
};

var partToJsAstStatement = function(x) {return exprToStatement(partToJsAstExpr(x));};

var toJsAST = function(ast, noEnv) {
	reqFns = {};
	var body = ast.map(partToJsAstStatement);
	var reqFnsK = Object.keys(reqFns);
	body = (reqFnsK.length === 0? [] :[{
		type: 'VariableDeclaration',
		kind: 'var',
		declarations: reqFnsK.map(function(x) {
			return {
				type: 'VariableDeclarator',
				id: {type: 'Identifier', name: x},
				init: reqFnsDef[x]
			};
		})
	}]).concat(body);
	if(noEnv) return body.length == 1? body[0]: {type: 'BlockStatement', body: body};
	return {
		type: 'ExpressionStatement',
		expression: {
			type: 'CallExpression',
			callee: {
				type: 'FunctionExpression',
				id: null,
				params: [],
				defaults: [],
				rest: null,
				body: {
					type: 'BlockStatement',
					body: body
				},
				generator: false,
				expression: false
			},
			arguments: []
		}
	};
};

var compile = function(s) {
	return toApfelkornAST(Parser.parse(s));
};

var compileJs = function(s, noEnv) {
	return Escodegen.generate(toJsAST(compile(s), noEnv), escOptions);
};

var log = function(x) {
	console.log(x);
	return x;
};

var visualizeApfelkornAST = function(x) {
	if(Array.isArray(x))
		return x.map(visualize).join(', ');
	else if(x.type) {
		var t = x.type;
		if(t == 'list') return '['+x.val.map(visualize).join(' ')+']';
	 	if(t == 'group') return '('+x.val.map(visualize).join(' ')+')';
		if(t == 'object') return '{'+x.val.map(visualize).join(' ')+'}';
		if(t == 'call') return '('+visualize(x.fn)+': '+x.args.map(visualize).join(' ')+')';
		if(t == 'index') return '('+visualize(x.col)+'#'+visualize(x.index)+')';
		if(t == 'suffix') return '('+visualize(x.val)+'`'+visualize(x.prefix)+')';
		if(t == 'chain') return '('+visualize(x.col)+').'+visualize(x.index);
		if(t == 'lambda') return '('+visualize(x.arg)+'\\'+visualize(x.body)+')';
		return x.val? visualize(x.val): ''+x;
	}
	return x.val? visualize(x.val): ''+x;
};

// Node.js
if(typeof global != 'undefined' && global) {
	// Export
	if(module && module.exports) module.exports = compileJs;
	// Commandline
	if(require.main === module) {
		var args = process.argv.slice(2), l = args.length;
		if(l === 0) {
			// REPL
			var Prelude = require('./prelude.js'); Prelude.merge(Prelude, global);
			console.log('Apfelkorn '+' REPL');
			var PARSEMODE = 0, EVALMODE = 1, mode = EVALMODE;
			process.stdin.setEncoding('utf8');
			function input() {
				process.stdout.write('> ');
				process.stdin.once('data', function(s) {
					try {
						if(s.trim() == 'setModeParse') mode = PARSEMODE;
						else if(s.trim() == 'setModeEval') mode = EVALMODE;
						else if(mode == PARSEMODE) console.log(compileJs(s, true));
						else if(mode == EVALMODE) console.log(eval(compileJs(s, true)));
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
						console.log(compileJs(s));
					}
				});
			}
		}
	}
}
