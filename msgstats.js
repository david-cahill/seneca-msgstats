/* Copyright (c) 2013 Richard Rodger, MIT License */
'use strict';

var connect      = require('connect');
var serveStatic  = require('serve-static');
var collector    = require('seneca-collector');

module.exports = function( options ) {
  var seneca = this 
  var plugin = 'msgstats'

  options = seneca.util.deepextend({
    pin:{},
    prefix:'/msgstats/',
    contentprefix:'/msgstats',
    influxOpts:{}
  },options)

  seneca.use(collector,options.influxOpts);

  seneca.add({role: plugin, ping: true}, ping);

  function ping(args, done) {
    done(null, {now:Date.now()});
  };

  function captureAllMessages(args) {
    var point = {};
    var meta  = args.meta$;
    point['pattern'] = meta.pattern;

    if(meta.pattern.indexOf('role:collector') === -1) {
      seneca.act({role:'collector', cmd:'send', point:point, options:options}, function(err, result) {
      });
    }
  }

  //Capture actions
  seneca.sub(options.pin, captureAllMessages);

  //-----API Section------//
  var data;
  function getData(fieldName, cb) {
    seneca.act({role:'collector', cmd:'get', fieldName:fieldName}, function(err,result){
      cb(null,result);
    });
  }
    

  function queryInflux(pattern, type, time, cb) {
    seneca.act({role:'collector', cmd:'get', pattern:pattern, type:type, time:time}, function(err,result){
       cb(null, result);
    });
  }

  function getSenecaPatterns(cb) {
    var patterns = seneca.list();
    cb(null, patterns);
  }

  function parseSenecaPatterns(patterns, searchTerm, cb) {
    var result = {};
    result['patterns'] = [];
    for(var i = 0; i < patterns.length;i++) {
      var pattern = '';
      for(var k in patterns[i]) {
        if(pattern === '') {
          pattern = k+ ':'+ patterns[i][k];
        } else {
          pattern = pattern + ',' + k+ ':'+ patterns[i][k];
        }
      }
      if(pattern.indexOf(searchTerm) > -1) {
        result['patterns'].push({pattern:pattern});
      }
    }
    cb(null, result);
  }

  var app = connect()
  app.use(serveStatic(__dirname+'/web'))
  var seriesName;
  var use = function(req,res,next){
    if( 0===req.url.indexOf(options.contentprefix) ) {
      if( 0 == req.url.indexOf(options.contentprefix+'/init.js') ) {
        res.writeHead(200,{'Content-Type':'text/javascript'})
        return res.end(initsrc+sourcelist.join('\n'));
      }
   
      req.url = req.url.substring(options.contentprefix.length)
      return app( req, res );
    }
    
    if(0 == req.url.indexOf('/influxdb/getData')) {
        seriesName = req.query.seriesName;
        getData(req.query.fieldName, function(err, response) {
          res.send(response);
        });
    } else if(0 == req.url.indexOf('/influxdb/queryInflux')) {
        var type = req.param('type');
        var time = req.param('time');
        queryInflux(req.param('actions'),type, time, function(err, response) {
          res.send(response);
        });
    } else if(0 == req.url.indexOf('/getPatterns')) {
        getSenecaPatterns(function(err, response) {
          res.send(response);
        });
    } else if(0 == req.url.indexOf('/searchPatterns')) {
        var searchTerm = req.param('s');
        getSenecaPatterns(function(err, response) {
          parseSenecaPatterns(response, searchTerm, function(err, response) {
              res.send(response);
          });
        });
    }

    else return next();
  }

  seneca.add({init:plugin},function(args,done) {
    var seneca = this

    var config = {prefix:options.contentprefix}

    seneca.act({role:'web',use:use, plugin:plugin,config:config})

    seneca.act({role:'util',note:true,cmd:'push',key:'admin/units',value:{
      unit:'msg-stats',
      spec:{title:'Message Statistics',ng:{module:'senecaMsgStatsModule',directive:'seneca-msg-stats'}},
      content:[
        {type:'js',file:__dirname+'/web/msg-stats.js'},
        {type:'js',file:__dirname+'/web/angular-load.js'},
        {type:'js',file:__dirname+'/web/angucomplete.js'}
      ]
    }})
    done()
  })

  return {
    name: plugin
  }
}