/* Copyright (c) 2013 Richard Rodger, MIT License */
'use strict';

var connect      = require('connect');
var serveStatic  = require('serve-static');
var collector    = require('seneca-collector');

module.exports = function( options ) {
  var seneca = this 
  var plugin = 'msgstats'

  options = seneca.util.deepextend({
    capture:'role:*',
    format:['role'],
    prefix:'/msgstats/',
    contentprefix:'/msgstats',
    influxOptions:{}
  },options)

  seneca.use(collector,options.influxOpts);

  seneca.add({role: plugin, ping: true}, ping);

  function ping(args, done) {
    done(null, {now:Date.now()});
  };

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
        }
      }
    }

    console.log("**** Point To Send = ****" + JSON.stringify(point));

    seneca.act({role:'collector', cmd:'send', point:point, options:options}, function(err, result) {
      console.log("****** data send result", result);
    });

    this.prior(args, done);
  }

   function captureAllMessagesV3(args) {
    //Check seneca args and look for capture fields in options.format.
    var captureFields = options.format;
    var point = {};
    var meta  = args.meta$;
    point['pattern'] = meta.pattern;

    if(meta.pattern.indexOf('role:collector') === -1) {
      console.log("**** Point To Send = ****" + JSON.stringify(point));
      seneca.act({role:'collector', cmd:'send', point:point, options:options}, function(err, result) {
        console.log("****** data send result", result);
      });
    }
  }


  //Capture all actions
  //seneca.wrap(options.capture, captureAllMessagesV2);
  seneca.sub({}, captureAllMessagesV3);

  //-----API Section------//
  var data;
  function getData(fieldName, cb) {
    seneca.act({role:'collector', cmd:'get', fieldName:fieldName}, function(err,result){
      cb(null,result);
    });
  }
    

  function queryInflux(pattern, cb) {
    seneca.act({role:'collector', cmd:'get', pattern:pattern}, function(err,result){
       cb(null, result);
    });
  }

  function getSenecaPatterns(cb) {
    var patterns = seneca.list();
    cb(null, patterns);
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
        queryInflux(req.param('actions'), function(err, response) {
          res.send(response);
        });
    } else if(0 == req.url.indexOf('/getPatterns')) {
        getSenecaPatterns(function(err, response) {
          res.send(response);
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
        {type:'js',file:__dirname+'/web/angular-load.js'}
      ]
    }})
    done()
  })

  return {
    name: plugin
  }
}