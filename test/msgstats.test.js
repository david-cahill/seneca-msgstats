/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";


var seneca = require('seneca')({log:'silent'});
seneca.use('..', {pin:'test:captureAction'});

var assert = require('assert');

describe('msgstats', function() {

  it('happy',function(done){
    seneca.act('role:msgstats,ping:true',function(err,out){
      if(err) return done(err);
      assert.ok( out.now )
      done()
    })
  });

  it('capture seneca action', function(done) {

  	seneca.add('test:captureAction', function(args, done) {
  		done(null, {});
  	})

  	seneca.act('test:captureAction', function(err, response) {

  	})
  	
  	seneca.sub('test:captureAction', function(args) {
  		assert.ok(args.meta$);
  		done()
  	});
  });

});
