(function () {
  console.log('\r\n\t1\r\n\t2\r\n\t3\r\n'.split('\r\n').map(function (x) {
    return x.trim();
  }).map(parseInt));
}());
