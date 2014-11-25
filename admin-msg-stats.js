;(function(angular,moment) {
  "use strict";

  var root = this
  var seneca = root.seneca
  var prefix = (seneca.config.web ? seneca.config.web.prefix : null ) || '/seneca'
  var adminprefix = (seneca.config.admin ? seneca.config.admin.prefix : null ) || '/admin'

  google.load('visualization', '1', {packages:['corechart']});
  var chartData;
  var data;

  google.setOnLoadCallback(function() { 
    getData(getDataCallback);
  });

  var getDataCallback = function(err, response) {
    data = new google.visualization.DataTable();
    data.addColumn('string', 'Action');
    data.addColumn('number', 'Count');
    updateGoogleChart(response);
  } 

  var queryDataCallback = function(err, response) {
    console.log("queryData callback ===" + response);
    updateGoogleChart(response);
  } 

  function drawChart() {
    var options = {
      title: 'Seneca Action Statistics',
      hAxis: {title: 'Action', titleTextStyle: {color: 'red'}},
      animation:{
        duration: 1000,
        easing: 'out',
      },
      vAxis: {minValue:0, maxValue:50}
    };

    var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
    chart.draw(data, options);
  }

  function updateGoogleChart(newData) {       
    for(var i = 0; i<newData.length;i++){
      data.addRow([newData[i][0], newData[i][1]]);
    }
    drawChart();
  }

  function getData(cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/getData?fieldName=*&seriesName=actions",
      type:'get',
      dataType:'jsonp',
      jsonpCallback: 'jsonPCallback'
    }).success(function(data) {
        var response = data;
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          var pattern  = response[i].pattern;
          var count = response[i].count;
          roleData.push(pattern); 
          roleData.push(count);
          result.push(roleData);
        }
      cb(null,result);
    })
  }

  function jsonPCallback() {
    console.log("jsonp callback called:...");
  }

  function queryInfluxDB(pattern,cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/queryInflux",
      type: 'get',
      data: {actions:pattern},
      dataType:'jsonp',
      jsonpCallback: 'jsonPCallback'
    }).success(function(data) {
        var response = data;
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          var role  = response[i].role;
          var cmd   = response[i].cmd;
          var pattern  = response[i].pattern;
          var count = response[i].count;
          roleData.push(pattern); 
          roleData.push(count);
          result.push(roleData);
          //updateGoogleChart(result);
        }
        cb(null,result)
    }); 
  }

  var senecaMsgStatsModule = angular.module('senecaMsgStatsModule',[]).
  directive('senecaMsgStats', ['$http', function($http) {
   return {
    controller: function( $scope ) {
      $("#pattern_form").submit(function( event ) {
        var pattern = $('#pattern_text').val();
        queryInfluxDB(pattern,queryDataCallback);
        event.preventDefault();
      });
    },
    templateUrl:prefix+'/_admin_msg_stats_template.html'
  }
  }])

  /*senecaMsgStatsModule.controller('chartCtrl', function($scope,$location) {
      //var path = window.location.pathname
  })*/


}.call(window,angular,moment));

