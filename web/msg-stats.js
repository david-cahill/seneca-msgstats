;(function(angular,moment) {
  "use strict";

  var root = this
  var seneca = root.seneca
  var prefix = (seneca.config.msgstats ? seneca.config.msgstats.prefix : null ) || '/msgstats'
  var adminprefix = (seneca.config.admin ? seneca.config.admin.prefix : null ) || '/admin'
  var chartData;
  var data;
  
  var getDataCallback = function(err, response) {
    data = new google.visualization.DataTable();
    data.addColumn('string', 'Action');
    data.addColumn('number', 'Count');
    updateGoogleChart(response);
  } 

  var queryDataCallback = function(err, response) {
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
      url: "/influxdb/getData?fieldName=*",
      type:'get',
      dataType:'json'
    }).success(function(data) {
        var response = parseInfluxData(data);
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          var pattern  = response[i].pattern;
          var count = response[i].count;
          var time = response[i].time
          roleData.push(pattern); 
          roleData.push(count);
          result.push(roleData);
        }
      cb(null,result);
    })
  }

  function getTimeData(cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/getData?fieldName=*",
      type:'get',
      dataType:'json'
    }).success(function(data) {
        var response = parseInfluxTimeData(data);
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          var time = response[i].time;
          var count = response[i].count;
          roleData.push(time); 
          roleData.push(count);
          result.push(roleData);
        }
      cb(null,result);
    })
  }

  function queryInfluxDB(pattern,cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/queryInflux",
      type: 'get',
      data: {actions:pattern},
      dataType:'json'
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
        }
        cb(null,result)
    }); 
  }

  function parseInfluxData(data) {
    if(data.length > 0) {
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
  }

  function parseInfluxTimeData(data) {
    if(data.length > 0) {
      var columns = data[0].columns;
      var points  = data[0].points;
      var timeIndex = columns.indexOf("time");
  
      var result = [];
      var count = 1;
      var countedRoles = [];

      for(var i = 0; i<points.length; i++) {

        var containsRole = _.contains(countedRoles,points[i][timeIndex]);

        if(!containsRole) {
          result.push({time:points[i][timeIndex],
                       count:count
                      });
          countedRoles.push(points[i][timeIndex]);
        } else {

          for(var j = 0; j < result.length; j++) {
            if(result[j].time === points[i][timeIndex]) {
              result[j].count++;
            }
          }
      }

      }
      return result;
    }
  }

  var senecaMsgStatsModule = angular.module('senecaMsgStatsModule', ['angularLoad']);
  senecaMsgStatsModule.directive('senecaMsgStats', ['$http','$window', '$q', function($http, $window, $q) {
    var def = {
      restrict:'A',
      scope:{
      },
      controller: function( $scope, $rootScope, angularLoad) {
        $("#pattern_form").submit(function( event ) {
          var pattern = $('#pattern_text').val();
          queryInfluxDB(pattern,queryDataCallback);
          event.preventDefault();
        });

        $("#chartType").change(function(event) {
          var val = $("#chartType").val();
          switch (val) {
            case 'actionCount':
            basic(document.getElementById("example"));
            break;
            case 'timeCount':
            basic_time(document.getElementById("example"));
            break;
            default:
            basic(document.getElementById("example"));
          }
        });
        
        function basic_time(container) {

            var
              d1    = [],
              options,
              graph,
              x, o;

            getTimeData(function(err, response) {
              for(var i = 0; i<response.length;i++) {
                d1.push([ response[i][0], response[i][1] ]);
              }
              graph = drawGraph();     
            });
               
            options = {
              xaxis : {
                mode : 'time', 
                labelsAngle : 45
              },
              selection : {
                mode : 'x'
              },
              HtmlText : false,
              title : 'Time'
            };
                  
            // Draw graph with default options, overwriting with passed options
            function drawGraph (opts) {
              // Clone the options, so the 'options' variable always keeps intact.
              o = Flotr._.extend(Flotr._.clone(options), opts || {});

              // Return a new graph.
              return Flotr.draw(
                container,
                [ d1 ],
                o
              );
            }
    
            Flotr.EventAdapter.observe(container, 'flotr:select', function(area){
              // Draw selected area
              graph = drawGraph({
                xaxis : { min : area.x1, max : area.x2, mode : 'time', labelsAngle : 45 },
                yaxis : { min : area.y1, max : area.y2 }
              });
            });
                  
            // When graph is clicked, draw the graph with default area.
            Flotr.EventAdapter.observe(container, 'flotr:click', function () { graph = drawGraph(); });
          }
        function basic(container) {

            var
              barData = [],
              barTicks = [],
              barLabels = [],
              intValues=[],
              i, graph, maxNum;

              getData(function(err, response) {
                
                for(var i = 0; i<response.length;i++) {
                  barTicks.push([i, response[i][0] ]);
                  var intvalue = response[i][1];
                  intValues.push(intvalue);
                  barData.push([ intvalue, i]);
                  barLabels.push([i, intvalue + '<br />'+barTicks[i][1]]);
                }

                maxNum = _.max(intValues);
                drawBars(container, barData,  barTicks, barLabels, maxNum);  
            });               
                            
          }

          function drawBars(container, data, barTicks, barlabels, maxNum) {  
          // Draw Graph
          Flotr.draw(
                container,
                [data],
                {
                    colors: ['#EF5205'],
                    htmlText: true,
                    fontSize: 25,
                    grid: {
                        outlineWidth: 1,
                        outline: 'ws',
                        horizontalLines: false,
                        verticalLines: true
                    },
                    bars: {
                        show: true,
                        horizontal: true,
                        shadowSize: 0,
                        barWidth: 0.5,
                        fillOpacity: 1
                    },
                    mouse: {
                        track: true,
                        relative: true,
                        trackFormatter: function (pos) {
                            var ret;
                            $.each(barlabels, function (k, v) {
                                if (v[0] == pos.y) {
                                    ret = v[1];
                                };
                            });
                            return ret
                        }
                    },
                    xaxis: {
                        min: 0,
                        max: maxNum,
                        margin: true,
                        tickDecimals: 0
                    },
                    yaxis: {
                        ticks: barTicks
                    }
                }
              );
        }
        angularLoad.loadScript('https://raw.githubusercontent.com/HumbleSoftware/Flotr2/master/flotr2.min.js').then(function() {
          basic(document.getElementById("example"));
        }).catch(function() {
          console.log("script load error");
        });
      },
      link: function (scope, element, attrs) {

      },
      templateUrl:prefix+"/_msg_stats_template.html"
    }
    return def
  }])


}.call(window,angular,moment));
