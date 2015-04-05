var assert = require('better-assert');
var Promise = require('../');

describe('ignore-tests', function () {
  it('ignoring a promise should call onIgnore', function (done) {
    new Promise(function(resolve, reject, onIgnored){
      onIgnored(function(){
        assert(true);
        done();
      });
    }).ignore()
  })
  it('ignoring a promise multiple times should call onIgnore only once', function () {
    var count = 0;
    var a = new Promise(function(resolve, reject, onIgnored){
      onIgnored(function(){
        count++;
      });
    });
    a.ignore();
    a.ignore();
    assert(count === 1);
  })
  it('ignoring a promise without onIgnore should not throw', function () {
    new Promise(function(resolve, reject){
    }).ignore();
    assert(true);
  })
  it('ignoring a promise with a non-function onIgnore should not throw', function () {
    new Promise(function(resolve, reject, onIgnore){
      onIgnore('string');
    }).ignore();
    assert(true);
  })
  
  describe('dont ignoring a promise', function () {
    it('that is already resolved', function (done) {
      var a = new Promise(function(resolve){resolve()});
      a.ignore();
      a.then(function(){
        assert(true);
        done()
      })
    })
    it('that is already rejected', function (done) {
      var a = new Promise(function(resolve, reject){reject()});
      a.ignore();
      a.catch(function(){
        assert(true);
        done()
      })
    })
  })
  describe('ignoring a promise', function () {
    it('that is not yet resolved', function (done) {
      var resolve;
      var a = new Promise(function(r){resolve = r});
      a.ignore();
      a.then(function(){
        assert(false);
      });
      resolve();
      setTimeout(done, 100);
    })
    it('that is not yet rejected', function (done) {
      var reject;
      var a = new Promise(function(_, r){reject = r});
      a.ignore();
      a.catch(function(){
        assert(false);
      });
      reject();
      setTimeout(done, 100);
    })
    describe('should cancel', function () {
      it('a single following then', function (done) {
        var resolve;
        var a = new Promise(function(r){resolve = r});
        var b = a.then(function(r){return r});
        a.ignore();
        b.then(function(){
          assert(false);
        });
        resolve();
        setTimeout(done, 100);
      })
      it('all following then', function (done) {
        var resolve;
        var a = new Promise(function(r){resolve = r});
        var b = a.then(function(r){return r});
        var c = a.then(function(r){return r});
        a.ignore();
        Promise.race([b, c]).then(function(){
          assert(false);
        });
        resolve();
        setTimeout(done, 100);
      })
    })
    describe('should ignore', function () {
      it('the previous promise', function (done) {
        var resolve;
        var a = new Promise(function(r){resolve = r});
        var b = a.then(function(r){return r});
        b.ignore();
        b.then(function(){
          assert(false);
        });
        resolve();
        setTimeout(done, 100);
      })
      it('all previous promises', function (done) {
        var resolve;
        var a = new Promise(function(r){resolve = r});
        var b = a.then(function(r){return r});
        var c = a.then(function(r){return r});
        c.ignore();
        Promise.race([a, b]).then(function(){
          assert(false);
        });
        resolve();
        setTimeout(done, 100);
      })
    })
    describe('should call the onIgnore handler', function () {
      it('of the previous promise', function (done) {
        var resolve;
        var a = new Promise(function(r, _, o){resolve = r; o(done);});
        var b = a.then(function(r){return r});
        b.ignore();
        b.then(function(){
          assert(false);
        });
        resolve();
      })
      it('all previous promises', function (done) {
        var resolve;
        var a = new Promise(function(r, _, o){resolve = r; o(done);});
        var b = a.then(function(r){return r});
        var c = b.then(function(r){return r});
        c.ignore();
        Promise.race([a, b]).then(function(){
          assert(false);
        });
        resolve();
      })
    })
    describe('should not ignore', function () {
      it('the previous promise if it has a then branch', function (done) {
        var resolve;
        var a = new Promise(function(r){resolve = r});
        var b = a.then(function(r){return r});
        var c = a.then(function(r){return r});
        b.ignore();
        b.then(function(){
          assert(false);
        });
        c.then(function(){
          assert(true);
          done();
        });
        resolve();
      })
      it('any previous promises if has a then branch', function (done) {
        var resolve;
        var a = new Promise(function(r){resolve = r});
        var b = a.then(function(r){return r});
        var c = b.then(function(r){return r});
        var d = b.then(function(r){return r});
        d.ignore();
        Promise.all([b, c]).then(function(){
          assert(true);
          done();
        });
        resolve();
      })
    })
    describe('that waits for B', function () {
      it('should ignore B', function (done) {
        var resolveA, resloveB;
        var a = new Promise(function(r){resolveA = r});
        var b = new Promise(function(r, _, o){resolveB = r; o(done);});
        var c = a.then(function(r){return b});
        c.then(function(){
          assert(false);
        });
        resolveA();
        a.then(function(){
          c.ignore();
          resolveB();
        });
      })
    })
  })
})