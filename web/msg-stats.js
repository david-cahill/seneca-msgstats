;(function(angular,moment) {
  "use strict";

  var root = this
  var seneca = root.seneca
  var prefix = (seneca.config.msgstats ? seneca.config.msgstats.prefix : null ) || '/msgstats'
  var adminprefix = (seneca.config.admin ? seneca.config.admin.prefix : null ) || '/admin'
  var chartData;
  var data;
  var selectedPatterns = [];
  var timeGraphData = [];

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

  function queryInfluxDB(pattern,time,cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/queryInflux",
      type: 'get',
      data: {actions:pattern,type:'normal',time:time},
      dataType:'json'
    }).success(function(data) {
      if(data.length > 0) {
        var response = parseInfluxData(data);
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          var pattern  = response[i].pattern;
          var count = response[i].count;
          var time = response[i].time;
          roleData.push(pattern); 
          roleData.push(count);
          roleData.push(time);
          result.push(roleData);
        }
        cb(null,result)
      }
    }); 
  }

  function queryInfluxDBTime(pattern, time, cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/queryInflux",
      type: 'get',
      data: {actions:pattern,type:'time', time:time},
      dataType:'json'
    }).success(function(data) {
      if(data.length > 0) {
        var response = parseInfluxTimeData(data);
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          //var pattern  = response[i].pattern;
          var count = response[i].count;
          var time = response[i].time;
          //roleData.push(pattern); 
          roleData.push(count);
          roleData.push(time);
          result.push(roleData);
        }
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
      var countIndex = columns.indexOf("count");
      var result = [];
      var count = 1;
      var countedRoles = [];

      for(var i = 0; i<points.length; i++) {
        result.push({time:points[i][timeIndex],
                     count:points[i][countIndex]});
      }
      return result;
    }
  }

  var msgStatsController = function( $scope, $rootScope, angularLoad) {
    var barTicks = [];
    var intValues = [];
    var barData = [];
    var barLabels = [];
    var intvalue;
    var i;
    var maxNum;
    var counter = 0;

    angularLoad.loadScript('/msgstats/flotr2.min.js').then(function() {
      basic(document.getElementById("example"),[],[],[],0);
    }).catch(function() {
      console.log("script load error");
    });

    //angularLoad.loadScript('https://code.jquery.com/ui/1.11.2/jquery-ui.js');
    angularLoad.loadCSS('/msgstats/msgstats.css');
    angularLoad.loadCSS('/msgstats/angucomplete.css');

    $(document).on('click', '.pattern_block_delete', function() {
      var patternUnchecked = $(this).attr('alt');
      var chartType = $("#chartType").val();
      var time      = $('#dateRange').val();
      var elementRemoved = false;
      if(chartType === 'actionCount') {
        for(var i = barData.length-1; i >= 0; i--) {
          if(barTicks[i][1] === patternUnchecked) {
            barData.splice(i,1);
            barTicks.splice(i,1);
            barLabels.splice(i,1);
            elementRemoved = true;
          }
        }
        if(elementRemoved) {
          for(var i = 0; i < barData.length; i++) {
            barData[i][0] = i;
            barTicks[i][0] = i;
            barLabels[i][0] = i;
          }
          counter = barData.length;
        }
        drawBars(document.getElementById('example'), barData, barTicks, barLabels, maxNum);
        $(this).parent().remove();
      } else {
        console.log("timeGraphData = "+JSON.stringify(timeGraphData));
        for(var i = 0; i < timeGraphData.length; i++) {
          if(timeGraphData[i].label === patternUnchecked) {
            timeGraphData.splice(i,1);
          }
        }
        console.log("timeGraphData 2 = "+JSON.stringify(timeGraphData));
        basic_time(document.getElementById('example'));
        $(this).parent().remove();
      }
    });

    $scope.selectResult = function(result) {
      $('#patternsAutoComplete_value').val('');
      var pattern = result.originalObject.pattern;
      //Add selected pattern to chart
      selectedPatterns.push(pattern);
      var chartType = $("#chartType").val();
      var time      = $('#dateRange').val();
      if(chartType === 'actionCount') {
        queryInfluxDB(pattern, time, function(err, response) {
          for(var i = 0; i<response.length;i++) {
            barTicks.push([ counter, response[i][0] ]);
            var intvalue = response[i][1];
            intValues.push(intvalue);
            barData.push([ counter, intvalue]);
            barLabels.push([ counter, intvalue + '<br />'+ response[i][0] ]);
            counter++;
          }
          maxNum = _.max(intValues);
          drawBars(document.getElementById('example'), barData, barTicks, barLabels, maxNum);
          addPatternBlock(pattern);
        });
      } else {
        var chartColors = ['black', 'red', 'blue', 'green', 'orange'];
        var colorIndex = Math.floor(Math.random()*chartColors.length);
        var color = chartColors[colorIndex];

        chartColors.splice(colorIndex,1);
        queryInfluxDBTime(pattern, time, function(err, response) {
          var tempData = []
          for(var i = 0; i<response.length;i++) {
                      //time, count
            tempData.push([ response[i][1], response[i][0] ]);
          }
          timeGraphData.push({data:tempData, label:pattern, color:color});
          basic_time(document.getElementById('example'));
          //drawTimeGraph(options, container, d1); 
        });

        addPatternBlock(pattern);
      }
    }

    function addPatternBlock(pattern) {
      $('#patternsAdded').append('<div class="pattern_block"><label class="pattern_block_text">'+pattern+'</label><img class="pattern_block_delete" alt="'+pattern+'" src="/msgstats/images/delete.png"></div>');
    }

    $("#pattern_form").submit(function( event ) {
      var pattern = $('#pattern_text').val();
      $("#example").show();
      basic_time(document.getElementById("example"));
      event.preventDefault();
    });

    //loadSenecaPatternsList();
    //$("#dateFrom").datepicker();
    //$("#dateTo").datepicker();

    $("#chartType").change(function(event) {
      var val = $("#chartType").val();
      barTicks = [];
      intValues = [];
      barData = [];
      barLabels = [];
      
      $('#patternsAdded').empty();
       var time = $('#dateRange').val();
      $(":checkbox").prop('checked', false);
      switch (val) {
        case 'actionCount':
        $("#example").show();
        basic(document.getElementById("example"),[],[],[],0);
        break;
        case 'timeCount':
        basic_time(document.getElementById("example"));
        break;
      }
    });

    function loadSenecaPatternsList() {
      $.ajax({
        url:'/getPatterns',
        type:'get',
        dataType:'json'
      }).success(function(data) {
        createPatternCheckboxes(data);
      });
    }

    function selectResult(result) {
      console.log("**** Select Result called: " + result);
    }

    function basic_time(container) {
      var
        d1    = [],
        options,
        graph,
        x, o;

      options = {
        xaxis : {
          mode : 'time', 
          labelsAngle : 45
        },
        yaxis: {
          min:0
        },
        selection : {
          mode : 'x'
        },
        HtmlText : false,
        title : 'Time'
      };

      /*queryInfluxDBTime(pattern, time, function(err, response) {
        for(var i = 0; i<response.length;i++) {
                    //time, count
          d1.push([ response[i][1], response[i][0] ]);
        }
        graph = drawTimeGraph(options, container); 
      });*/

      // Draw graph with default options, overwriting with passed options
      /*function drawGraph (opts) {
        // Clone the options, so the 'options' variable always keeps intact.
        o = Flotr._.extend(Flotr._.clone(options), opts || {});
        // Return a new graph.
        return Flotr.draw(
          container,
          [ d1 ],
          o
        );
      }*/

      graph = drawTimeGraph(options, container); 

      Flotr.EventAdapter.observe(container, 'flotr:select', function(area){
        // Draw selected area
        var opts = {
          xaxis : { 
            min : area.x1, 
            max : area.x2, 
            mode : 'time', 
            labelsAngle : 45 },
          yaxis : { 
            min : area.y1, 
            max : area.y2 }
        };
        var extendedOpts = _.extend(_.clone(options), opts);
        graph = drawTimeGraph(extendedOpts, container);
         //basic_time(document.getElementById('example'));
      });
            
      // When graph is clicked, draw the graph with default area.
      Flotr.EventAdapter.observe(container, 'flotr:click', function () { graph = drawTimeGraph(options, container); });
    }

    function drawTimeGraph(opts, container) {
      var graph;
      var options = {
        xaxis : {
          mode : 'time', 
          labelsAngle : 45
        },
        yaxis: {
          min:0
        },
        selection : {
          mode : 'x'
        },
        HtmlText : false,
        title : 'Time'
      };
      
      var o = Flotr._.extend(Flotr._.clone(opts) || {});
      // Return a new graph.
      return Flotr.draw(
        container,
        timeGraphData,
        o
      );

    }

    function basic(container, barData, barTicks, barLabels, maxNum) {
      drawBars(container, barData,  barTicks, barLabels, maxNum);                           
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
            horizontalLines: true,
            verticalLines: false
          },
          bars: {
            show: true,
            horizontal:false,
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
                  if (v[0] == pos.x) {
                      ret = v[1];
                  };
              });
              return ret;
            }
          },
          xaxis: {
            ticks: barTicks
          },
          yaxis: {
            min: 0,
            max: maxNum,
            margin: true,
            tickDecimals: 0
          }
        }
      );
    }
  }

  var senecaMsgStatsModule = angular.module('senecaMsgStatsModule', ['angularLoad', 'angucomplete']);
  senecaMsgStatsModule.directive('senecaMsgStats', ['$http','$window', '$q', function($http, $window, $q) {
    var def = {
      restrict:'A',
      scope:{
      },
      controller: msgStatsController,
      link: function ($scope, element, attrs) {

      },
      templateUrl:prefix+"/_msg_stats_template.html"
    }
    return def
  }])


}.call(window,angular,moment));
