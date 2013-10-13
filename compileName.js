(function() {
	var IllegalChars = {
		'~': '_TILDE_', '`': '_BACKTICK_', '!': '_BANG_', '@': '_AT_',
		'%': '_PERCENT_', '^': '_CARAT_', '&': '_AMPERSAND_', '*': '_ASTERISK_',
		'-': '_MINUS_', '+': '_PLUS_', '=': '_EQ_', '|': '_PIPE_', '?': '_QUESTION_',
		'/': '_SLASH_', '>': '_GTHAN_', '<': '_LTHAN_' 
	};
	function removeIllegalCharacters(s) {
		var r = [];
		for(var i=0,l=s.length,last=0;i<l;i++) {
			var c = s[i];
			if(IllegalChars[c]) {
				r.push(s.substring(last, i), IllegalChars[c]);
				last = i+1;
			}
		}
		r.push(s.substring(last, i));
		return r.join('');
	};

	// temp macro conversions
	var macroNames = {
		'+': 'add',
		'-': 'sub',
		'*': 'mul',
		'/': 'div',
		'%': 'rem',
		'^': 'pow',

		'~*': 'map',
		'~/': 'reduce',
		'~-': 'filter',

		'/+': 'sum',
		'/*': 'prd',
		'~^': 'cart',
		'~%': 'zip',
		'~+': 'concat',
		'~&': 'flatten',
		'~!': 'uniq',
		'~~': 'wrap',
		'~?': 'wrapp',
		'~*!': 'mapcf',

		'!<': 'curry',
		'!>': 'curryr',
		'!!': 'apply',
		'!~': 'revargs',
		'!%': 'reflex',
		'!^': 'fpow',
		'!~^': 'fpowr',
		'@': 'compose',
		'@~': 'composer',
		'|': 'max',
		'&': 'min',
		'!?': 'iff',

		'=': 'eq',
		'!=': 'neq',
		'>': 'gr',
		'>=': 'greq',
		'<': 'ls',
		'<=': 'lseq',

		'!': 'not',
		'&&': 'and',
		'&&!': 'nand',
		'||': 'or',
		'||!': 'nor',
	};

	var compileSymbolName = function(n) {
		if(macroNames[n]) return macroNames[n];
		return removeIllegalCharacters(n);
	};

	function compile(n) {
		if(n.type != 'name') throw 'Not a name: '+n;
		if(n.symbol) return {
			type: 'Identifier',
			name: compileSymbolName(n.val)
		};
		return {
			type: 'Identifier',
			name: n.val
		};
	};

	module.exports = compile;
})();
