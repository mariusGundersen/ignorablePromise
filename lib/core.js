'use strict';

var asap = require('asap')

var PENDING = 0;
var FULFILLED = 1;
var REJECTED = 2;
var IGNORED = -1;

// Use Symbol if it's available, but otherwise just
// generate a random string as this is probably going
// to be unique
var handleSymbol = typeof Symbol === 'function' ?
    Symbol() :
    (
      '_promise_internal_key_handle_' +
      Math.random().toString(35).substr(2, 10) + '_'
    )

module.exports = Promise;
function Promise(fn) {
  if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new')
  if (typeof fn !== 'function') throw new TypeError('not a function')
  var state = PENDING
  var value = null
  var deferreds = []
  var cancel = null
  var self = this

  this.ignore = function(){
    if(state === PENDING){
      state = IGNORED;
      if(cancel)
        cancel();
      finale();
    }
  }
  
  this.then = function(onFulfilled, onRejected) {
    var p = new self.constructor(function(resolve, reject, setCancelHandler) {
      var handler = new Handler(onFulfilled, onRejected, resolve, reject, function(){p.ignore()});
      handle(handler);
      setCancelHandler(function(){
        if(state !== PENDING) return;
        var index = deferreds.indexOf(handler);
        if(index>=0){
          deferreds.splice(index,1);
          if(deferreds.length === 0)
            self.ignore();
        }
      });
    });
    return p;
  }
  this.then[handleSymbol] = handle;
  function handle(deferred) {
    return internalHandle(deferred);
  }
  function internalHandle(deferred) {
    if (state === PENDING) {
      deferreds.push(deferred)
      return
    }
    asap(function() {
      if(state === IGNORED){
        deferred.cancel();
        return
      }
      var cb = state === FULFILLED ? deferred.onFulfilled : deferred.onRejected
      if (cb === null) {
        (state === FULFILLED ? deferred.resolve : deferred.reject)(value)
        return
      }
      var ret
      try {
        ret = cb(value)
      }
      catch (e) {
        deferred.reject(e)
        return
      }
      deferred.resolve(ret)
    })
  }

  function resolve(newValue) {
    if(state === IGNORED){
      return
    }
    try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.')
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then
        if (typeof then === 'function') {
          if (typeof then[handleSymbol] === 'function') {
            // to prevent a memory leak, we adopt the value of the other promise
            // allowing this promise to be garbage collected as soon as nobody
            // has a reference to it
            internalHandle = then[handleSymbol];
            cancel = newValue.ignore;
            deferreds.forEach(function (deferred) {
              internalHandle(deferred);
            });
          } else {
            if(newValue.ignore && typeof newValue.ignore === 'function'){
              cancel = newValue.ignore;
            }else{
              cancel = null;
            }
            doResolve(then.bind(newValue), resolve, reject)
          }
          return
        }
      }
      state = FULFILLED
      value = newValue
      finale()
    } catch (e) { reject(e) }
  }

  function reject(newValue) {
    if(state === IGNORED){
      return
    }
    state = REJECTED
    value = newValue
    finale()
  }

  function finale() {
    for (var i = 0, len = deferreds.length; i < len; i++)
      handle(deferreds[i])
    deferreds = null
  }

  doResolve(function(resolve, reject){
    fn(resolve, reject, function(onCancel){
      if (typeof onCancel !== 'function') throw new TypeError('cancel not a function')
      if(cancel === null)
        cancel = onCancel;
    });
  }, resolve, reject)
}


function Handler(onFulfilled, onRejected, resolve, reject, cancel){
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
  this.onRejected = typeof onRejected === 'function' ? onRejected : null
  this.resolve = resolve
  this.reject = reject
  this.cancel = cancel
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, onFulfilled, onRejected) {
  var done = false;
  try {
    fn(function (value) {
      if (done) return
      done = true
      onFulfilled(value)
    }, function (reason) {
      if (done) return
      done = true
      onRejected(reason)
    })
  } catch (ex) {
    if (done) return
    done = true
    onRejected(ex)
  }
}