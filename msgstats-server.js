/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";

var seneca = require('seneca')();
var influx = require('influx');

var client = influx({
	//cluster configuration
	hosts : [
	  {
	    host : 'localhost',
	    port : 8086 //optional. default 8086
	  }
	],
	// or single-host configuration
	host : 'localhost',
	port : 8086, // optional, default 8086
	username : 'root',
	password : 'root',
	database : 'test_db2'
});

function sendData() {
    this.add({role:'data', cmd:'send'}, function(args,done){

    	console.log(">>>>> sending point:", args.point);

		client.writePoint('actions', args.point, args.options, function(response) {
			console.log(">>>>>>","successfully sent data...." + response);
			done(null, {data:'received'});
		});

    });
 }

function getData() {
	this.add({role:'data', cmd: 'get'}, function(args, done) {
		client.query(args.query, function(err,response) {
      		done(null,response);
    	});
	});
}

seneca
  .use(sendData)
  .use(getData)
  .listen(4000);