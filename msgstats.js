/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";

var _ = require('underscore');
var seneca2 = require('seneca')();
var seneca3 = require('seneca')();
var express = require('express')
var bodyParser = require('body-parser')
var influx = require('influx');
var connect = require('connect');
var qs = require('qs');

module.exports = function( options ) {
  var seneca = this;
  var plugin = 'msgstats';
  
  options = seneca.util.deepextend({
  	capture:'role:*',
    format:['role'],
    influxOptions:{}
  }, options);

  //-----Server Section---//
  var client = influx({
    //cluster configuration
    hosts : [
      {
        host : options.influxOpts.host,
        port : options.influxOpts.port //optional. default 8086
      }
    ],
    // or single-host configuration
    host : options.influxOpts.host,
    port : options.influxOpts.port,// optional, default 8086
    username : options.influxOpts.username,
    password : options.influxOpts.password,
    database : options.influxOpts.database
  });

  function sendServerData() {
    seneca3.add({role:'data', cmd:'send'}, function(args,done){

    console.log(">>>>> sending point:", args.point);

    client.writePoint('actions', args.point, args.options, function(response) {
      console.log(">>>>>>","successfully sent data...." + response);
      done(null, {data:'received'});
    });

    });
  }

  function getServerData() {
    seneca3.add({role:'data', cmd: 'get'}, function(args, done) {
      client.query(args.query, function(err,response) {
            done(null,response);
        });
    });
  }

  seneca3
  .use(sendServerData)
  .use(getServerData)
  .listen(4000);

  //----------------------//

  seneca.add({role: plugin, ping: true}, ping);

  seneca.add( {role:'influxdb', cmd:'getData'}, function(args,callback) {
    getLatestChartData({fieldName:args.fieldName, seriesName:args.seriesName}, function(err,response) {
      callback(null,response);
    });
  });

  seneca.add( {role:'influxdb', cmd:'queryData'}, function(args,callback) {
    queryChartDataPattern({pattern:args.pattern, seriesName:args.seriesName}, function(err,response) {
      callback(null,response)
    });
  });

  seneca.wrap({role:'math', cmd:'*'}, function(args,done) {//captureData
    console.log("capture data args = " + JSON.stringify(args));
    console.log("**** capture data called, sending data to influxdb");
    var point = {
                  role:args.role,
                  cmd:args.cmd
                };
    // send point to seneca host service
    seneca2.client(4000).act({role:'data', cmd:'send', point:point, options:options}, function(err, result) {
      console.log("****** data send result", result);
    });

    this.prior(args,done);
  });

  function ping(args, done) {
    done(null, {now:Date.now()});
  };

  function getLatestChartData(args,done) {
    var query = 'SELECT ' + args.fieldName + ' FROM ' + args.seriesName;
    seneca2.client(4000).act({role:'data', cmd:'get', query:query}, function(err, result) {
      done(null,parseInfluxDataV2(result));
    });
  }

  function queryChartData(args,done) {
    console.log("args.pattern = " + args.pattern);
    var pattern = args.pattern;
    //pattern = Object.keys(pattern)[0];
    var splitPattern = pattern.split(":");
    var role = splitPattern[0];
    var cmd  = splitPattern[1];
    var query = "SELECT * FROM " + args.seriesName + " WHERE role ='"+role+ "' AND plugin ='"+cmd+"'";
    seneca2.client(4000).act({role:'data', cmd:'get', query:query}, function(err, result) {
      done(null,parseInfluxDataV2(result));
    });
  }

  function queryChartDataPattern(args,done) {
    console.log("args.pattern = " + args.pattern);
    var pattern = args.pattern;
    //pattern = Object.keys(pattern)[0];
    var splitPattern = pattern.split(":");
    var role = splitPattern[0];
    var cmd  = splitPattern[1];
    var query = "SELECT * FROM " + args.seriesName + " WHERE pattern ='"+args.pattern+"'";
    seneca2.client(4000).act({role:'data', cmd:'get', query:query}, function(err, result) {
      done(null,parseInfluxDataV2(result));
    });
  }

  /*function parseInfluxPattern(data) {
    var columns = data[0].columns;
    var points  = data[0].points;
    var patternIndex = columns.indexOf("pattern");

    var result = [];
    var count = 0;
    var countedRoles = [];

    for(var i = 0; i<points.length; i++) {
      var containsRole = _.contains(countedRoles,points[i][patternIndex]);

      if(!containsRole) {
        result.push({"pattern":points[i][patternIndex]});
        countedRoles.push(points[i][patternIndex]);
    } else {
          for(var j = 0; j < result.length; j++) {
            if(result[j].pattern === points[i][patternIndex]) {
              result[j].count++;
            }
          }
      }

  }*/

  /*function parseInfluxData(data) {
    var columns = data[0].columns;
    var points  = data[0].points;
    var roleIndex = columns.indexOf("role");
    var cmdIndex  = columns.indexOf("plugin");

    var result = [];
    var count = 0;
    var countedRoles = [];

    for(var i = 0; i<points.length; i++) {

      var containsRole = _.contains(countedRoles,points[i][roleIndex]+":"+points[i][cmdIndex]);

      if(!containsRole) {
        result.push({"role":points[i][roleIndex],
                     "cmd" :points[i][cmdIndex],
                     "count":count
                    });
        countedRoles.push(points[i][roleIndex]+":"+points[i][cmdIndex]);
      } else {

        for(var j = 0; j < result.length; j++) {
          if(result[j].role === points[i][roleIndex] && result[j].cmd === points[i][cmdIndex]) {
            result[j].count++;
          }
        }
    }

    }
    return result;
  }*/

  function parseInfluxDataV2(data) {
    var columns = data[0].columns;
    var points  = data[0].points;
    var patternIndex = columns.indexOf("pattern");

    var result = [];
    var count = 1;
    var countedRoles = [];

    for(var i = 0; i<points.length; i++) {

      var containsRole = _.contains(countedRoles,points[i][patternIndex]);

      if(!containsRole) {
        result.push({pattern:points[i][patternIndex],
                     count:count
                    });
        countedRoles.push(points[i][patternIndex]);
      } else {

        for(var j = 0; j < result.length; j++) {
          if(result[j].pattern === points[i][patternIndex]) {
            result[j].count++;
          }
        }
    }

    }
    return result;
  }


  /*function captureAllMessages(args, done) {
    console.log("*** capture all messages called");
    console.log("Args =" + JSON.stringify(args));
    console.log("**** Format = " + options.format);
    var actions = options.format;
    //var point = {'pattern':''};
    var point = {};
    var actionPairs = [];
    //pattern = {role:}


    for(var i = 0; i < actions.length; i++) {
      actionPairs.push(actions[i]+':'+args[actions[i]]);
    }

    //for(var i = 0; i < actionPairs.length; i++) {
    //  point['pattern'] = point['pattern'] + ' ' + (actionPairs[i]);
    //}

    for(var i = 0; i < actions.length; i++) {
      point[actions[i]] = args[actions[i]];
    }

    console.log("***>>>>>>>>>>",point);
    // send point to seneca host service
    seneca2.client(4000).act({role:'data', cmd:'send', point:point, options:options}, function(err, result) {
      console.log("****** data send result", result);
    });

    this.prior(args,done);
  }*/

  function captureAllMessagesV2(args, done) {
    //Check seneca args and look for capture fields in options.format.
    var captureFields = options.format;
    var point = {};

    for(var i = 0; i < captureFields.length; i++) {
      if(args[captureFields[i]]) {
        if(!point['pattern']) {
          point['pattern'] = captureFields[i]+':'+args[captureFields[i]];
        } else {
          point['pattern'] = point['pattern'] + ","+captureFields[i]+':'+args[captureFields[i]];
          //point['pattern'].push(captureFields[i]+'-'+args[captureFields[i]]);
        }
      }
    }

    console.log("**** Point To Send = ****" + JSON.stringify(point));

    seneca2.client(4000).act({role:'data', cmd:'send', point:point, options:options}, function(err, result) {
      console.log("****** data send result", result);
    });

    this.prior(args, done);
  }

  seneca.wrap(options.capture, captureAllMessagesV2);

  //-----API Section------//
  var data;
  function getData(cb) {
    seneca.act( {role:'influxdb', cmd:'getData', fieldName:'*', seriesName:'actions'}, function(err,result){
      cb(null,result);
    });
  }

  function queryInflux(pattern, cb) {
    seneca.act( {role:'influxdb', cmd:'queryData', pattern:pattern, seriesName:'actions'}, function(err,result){
      cb(null, result);
    });
  }

  var app = express();
  app.use(seneca.export('web'));
  seneca.act('role:web',{use:function(req,res,next) {

    if(0 == req.url.indexOf('/influxdb/getData')) {
      var result = getData(function(err, response) {
        res.send('jsonPCallback('+JSON.stringify(response)+');');
      });
    } else if(0 == req.url.indexOf('/influxdb/queryInflux')){
      var result = queryInflux(req.param('actions'), function(err, response) {
        res.send('jsonPCallback('+JSON.stringify(response)+');');
      });
    } else {
      next()
    }

  }});

  app.listen(3000);
  //----------End of API Section------//
  return {name: plugin};
};
