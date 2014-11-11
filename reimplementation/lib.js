function eq(a, b) {
	if(a === b) return true;
	var t = typeof a;
	if(t !== typeof b || t !== 'object') return false;
	if(Array.isArray(a)) {
 		if(!Array.isArray(b)) return false; 
		var l = a.length;
		if(l !== b.length) return false;
		if(l === 0) return true;
		for(var i = 0; i < l; i++)
			if(!eq(a[i], b[i]))
				return false;
		return true;
	}
	if(a.equals && typeof a.equals === 'function')
		return a.equals(b);
	for(var k in a)
		if(a.hasOwnProperty(k))	
			if(typeof b[k] === 'undefined' || !eq(a[k], b[k]))
				return false;
	return true;
}

function smartindex(o, i) {
	return typeof o.get == 'function'? return o.get(i): typeof o == 'function'? o(i): o[i];
}

function isType(x, t) {
	return Object(x) instanceof t;
}

function type(x, t) {
	if(!isType(x, t)) throw TypeError('Expected ' + t + ' got ' + x);
	return x;
}
