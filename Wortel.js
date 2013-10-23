/*
	Wortel
	@author: Albert ten Napel
	@version: 0.1 
*/

var Wortel = (function() {
	// Parser
	var symbols = '~`!@#%^&*-+=|\\:;?/><,';
	function isSymbol(c) {return symbols.indexOf(c) != -1};
	var brackets = '()[]{}';
	function isBracket(c) {return brackets.indexOf(c) != -1};
	function otherBracket(c) {var n = brackets.indexOf(c); return n == -1? false: brackets[n+(n%2?-1:1)]};
	function isValidName(c) {return /[0-9a-z\_\$\.]/i.test(c)};

	function parse(s) {
		var START = 0, NUMBER = 1, SYMBOL = 2, NAME = 3, STRING = 4,
				r = [], t = [], strtype = esc = false;
		for(var i = 0, l = s.length, state = START, c; c = s[i], i < l; i++) {
			if(state == START) {
				if(isBracket(c)) r.push({type: c});
				else if(c == "'" || c == '"') strtype = c, state = STRING;
				else if(/[0-9]/.test(c)) t.push(c), state = NUMBER;
				else if(isSymbol(c)) t.push(c), state = SYMBOL;
				else if(isValidName(c)) t.push(c), state = NAME;
			} else if(state == NUMBER) {
				if(/[^0-9a-z\.]/i.test(c))
					r.push({type: 'number', val: t.join('')}), t = [], i--, state = START;
				else t.push(c);
			} else if(state == SYMBOL) {
				if(!isSymbol(c))
					r.push({type: 'symbol', val: t.join('')}), t = [], i--, state = START;
				else t.push(c);
			} else if(state == NAME) {
				if(!isValidName(c))
					r.push({type: 'name', val: t.join('')}), t = [], i--, state = START;
				else t.push(c);
			} else if(state == STRING) {
				if(esc) esc = false, t.push(c);
				else if(c == '\\') t.push(c), esc = true;
				else if(c != strtype) t.push(c);
				else r.push({type: 'string', strtype: strtype, val: t.join('')}), t = [], state = START;
			}
		}

		// Handle special operators
		// TODO
		
		// Group brackets
		// TODO

		return r;
	};

	// Compilation
	function toAST(p) {
		return p;
	};

	function toJS(ast) {
		return ast;
	};

	function compile(s) {return toJS(toAST(parse(s)))};

	return {
		parse: parse,
		toAST: toAST,
		toJS: toJS,
		compile: compile
	};
})();
