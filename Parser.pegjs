/*
	Apfelkorn grammar
	@author: Albert ten Napel
	@version: 2013-9-7
*/

start =  rest: (_ expr _)* {return rest.map(function(x) {return x[1]})}

expr = specialOps / list / object / group / string / number / name / comment

// special operators
specialOps = colon / comma / semicolon / backslash / backtick / dotdot / dot
colon = ':' {return {type: 'colon'}}
comma = ',' {return {type: 'comma'}}
semicolon = ';' {return {type: 'semicolon'}}
backslash = '\\' {return {type: 'backslash'}}
backtick = '`' {return {type: 'backtick'}}
dot = '.' {return {type: 'dot'}}
dotdot = '..' {return {type: 'dotdot'}}

/*
	Name
*/

name = symbolName / alphaName

legalSymbol = [\~\!\@\%\^\&\*\-\+\=\|\?\/\>\<]

symbolName = val: legalSymbol+ {return {
		type: 'name',
		symbol: true,
		val: (val || []).join('')
	}}

alphaName =
	initial: [A-Za-z\$\_]+
	rest: [A-Za-z0-9\$\_]* {return {
		type: 'name',
		symbol: false,
		val: initial.join('') + (rest || []).join('')
	}}

/*
	Number
	Example: 1 -1 1.2 1K 1.2L 4e10 4e10r9.6K Infinity NaN
	
	2K -> 2000
	2P -> 2*PI
	2e3 -> 2000

	Uppercase suffixes (such as P) and lowercase infixes (such as e)
*/

number =
	(number: simpleNumber
	 mods: numberModifier*) {return {
		type: 'number',
		val: number,
		mods: mods || []
	}} /
	(prefix: [\-\+]?
	 val: ('Infinity' / 'NaN')) {return {
		type: 'number',
		val: +(prefix+val),
		mods: []
	}}

numberModifier =
	mod: [a-z]
	number: simpleNumber {return {
		mod: mod,
		number: number
	}}

simpleNumber =
	prefix: [\-\+]?
	number: [0-9]+
	fraction: ('.'[0-9]+)?
	suffix: [A-Z]* {return {
		val: +(prefix+number.join('')+(!fraction? '': fraction[0]+(fraction[1] || []).join(''))),
		suffix: suffix || []
	}}

/*
	String
*/

string =
	'"' inner: (('\\'.) / [^\\\"])* '"' {return{
		type: 'string',
		strtype: 'double',
		val: inner.map(function(x) {return Array.isArray(x)? x: [x]}).reduce(function(x, y) {return x.concat(y)}, []).join('')
	}} /
	"'" inner: (('\\'.) / [^\\\'])* "'" {return{
		type: 'string',
		strtype: 'single',
		val: inner.map(function(x) {return Array.isArray(x)? x: [x]}).reduce(function(x, y) {return x.concat(y)}, []).join('')
	}}

/*
	List
*/

list = '[' _ inner: (_ expr _)* _ ']' {return{
		type: 'list',
		val: inner.map(function(x) {return x[1]}) || []
	}}

/*
	Object
*/

object = '{' _ inner: (_ expr _)* _ '}' {return{
		type: 'object',
		val: inner.map(function(x) {return x[1]}) || []
	}}

/*
	Group
*/

group = '(' _ inner: (_ expr _)* _ ')' {return{
		type: 'group',
		val: inner.map(function(x) {return x[1]}) || []
	}}

/*
 Comment
*/

comment = '#*' text: (('*' [^\#]) / [^\*])* '*#' {return{
		type: 'comment',
		val: text.join('')
	}} /
	'#' text: [^\n\r]* ('\n' / '\r') {return{
		type: 'comment',
		val: text.join('')
	}}

// Useful consts
whitespace = [\r\t\n\ ]
_ = whitespace*
