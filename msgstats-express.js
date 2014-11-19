"use strict"

var express = require('express')
var seneca = require('seneca')()
var msgstats = require('seneca-msgstats');
var bodyParser = require('body-parser')
seneca.use('msgstats', {});

var data;
setInterval(getData, 2000);

function getData() {
	seneca.act( {role:'influxdb', cmd:'getData', fieldName:'*', seriesName:'actions'}, function(err,result){
		data = result;
	});
}

function queryInflux(pattern, cb) {
	var response = 'test';
	console.log("************ Seneca.act pattern = " + JSON.stringify(pattern));
	seneca.act( {role:'influxdb', cmd:'queryData', pattern:pattern, seriesName:'actions'}, function(err,result){
		response = result;
		cb(null, response);
	});
}

var app = express();
app.use('/', express.static(__dirname));
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 

app.get('/data', function(req, res){
  res.send(data); //replace with your data here
});

app.get('/jsonpData', function(req, res){
  res.send('jsonPCallback('+JSON.stringify(data)+');'); //replace with your data here
});

app.post('/queryInflux', function(req, res){
  var response = queryInflux(req.body, function(err, result) {
  	res.send(result);
  });   
 
});

app.get('/jsonpQueryInflux', function(req, res){
  console.log(req.param('actions'));
  var response = queryInflux(req.param('actions'), function(err, result) {
  	res.send('jsonPCallback('+JSON.stringify(result)+');');
  });   
 
});


app.listen(3000);