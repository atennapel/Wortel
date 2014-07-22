(function() {
	var app = angular.module('Wortel', []).config(function($routeProvider){
		$routeProvider.when('/home', {
			templateUrl: 'page/home.html',
			controller: 'HomeCtrl'
		}).otherwise({redirectTo: '/home'});
	});

	app.controller('HomeCtrl', function($scope) {
		$(document).delegate('textarea', 'keydown', function(e) {
			var keyCode = e.keyCode || e.which;
			if(keyCode == 9) {
				e.preventDefault();
				var start = $(this).get(0).selectionStart;
				var end = $(this).get(0).selectionEnd;
				$(this).val($(this).val().substring(0, start)+'\t'+$(this).val().substring(end));
				$(this).get(0).selectionStart = $(this).get(0).selectionEnd = start + 1;
			}
		});

		function error(scope, o) {
			$('#output').attr('disabled', 'true');
			$('#output').addClass('error');
			scope.output = ''+o;
		};

		$scope.getWidth = function() {return $(window).width()};
		$scope.getHeight = function() {return $(window).height()};
    $scope.$watch($scope.getWidth, function(newv) {$scope.wwidth = newv});
    $scope.$watch($scope.getHeight, function(newv) {$scope.wheight = newv});
    window.onresize = function(){$scope.$apply()};

		$scope.input = [ 
			'@let {',
			'	; Mapping over a matrix.',
			'	life &m ~!* m &[a y] ~!* a &[v x] @let {',
			'		neigh @sum [',
			'			@`-x 1 @`-y 1 m  @`x @`-y 1 m  @`+x 1 @`-y 1 m',
			'			@`-x 1 @`y    m                @`+x 1 @`y    m',
			'			@`-x 1 @`+y 1 m  @`x @`+y 1 m  @`+x 1 @`+y 1 m',
			'		]',
			'		@+ || = neigh 3 && v = neigh 2',
			'	}',
			'	; testing it out',
			'	!console.log !lifeMatrix !life [',
			'		[0 0 0 0 0]',
			'		[0 0 0 0 0]',
			'		[0 1 1 1 0]',
			'		[0 0 0 0 0]',
			'		[0 0 0 0 0]',
			'	]',
			'}'
		].join('\n');
		$scope.output = '';
		$scope.debug = false;
		$scope.compile = function() {
			$('#output').removeAttr('disabled');
			$('#output').removeClass('error');
			var result;
			try {
				result = Wortel.compile($scope.input);
			} catch(e) {
				error($scope, e);
			}
			if(result) $scope.output = result;
			console.log(eval($scope.output));
		};
	});
})();
