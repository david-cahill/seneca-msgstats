;(function(angular,moment) {
  "use strict";

  var root = this
  var seneca = root.seneca
  var prefix = (seneca.config.msgstats ? seneca.config.msgstats.prefix : null ) || '/msgstats'
  var adminprefix = (seneca.config.admin ? seneca.config.admin.prefix : null ) || '/admin'
  var selectedPatterns = [];
  var timeGraphData = [];
  var http;

  function queryInfluxDBTime(pattern, time, cb) {
    var result = [];
    http({url:'/influxdb/queryInflux', method:'get', params:{actions:pattern,type:'time', time:time}}).
    success(function(data, status, headers, config) {
      if(data.length > 0) {
        var response = parseInfluxTimeData(data);
        for(var i = 0; i < response.length; i++) {
          var roleData = [];
          var count = response[i].count;
          var time = response[i].time;
          roleData.push(count);
          roleData.push(time);
          result.push(roleData);
        }
      }
      cb(null,result)
    });
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
      basic_time(document.getElementById("example"));
    }).catch(function() {
      console.log("script load error");
    });
    
    angularLoad.loadCSS('/msgstats/msgstats.css');
    angularLoad.loadCSS('/msgstats/angucomplete.css');

    $(document).on('click', '.pattern_block_delete', function() {
      var patternUnchecked = $(this).attr('alt');
      var chartType = $("#chartType").val();
      var time      = $('#dateRange').val();
      var elementRemoved = false;
      if(chartType === 'timeCount') {
        for(var i = 0; i < timeGraphData.length; i++) {
          if(timeGraphData[i].label === patternUnchecked) {
            timeGraphData.splice(i,1);
          }
        }
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
      if(chartType === 'timeCount') {
        queryInfluxDBTime(pattern, time, function(err, response) {
          var tempData = []
          for(var i = 0; i<response.length;i++) {
                      //time, count
            tempData.push([ response[i][1], response[i][0] ]);
          }
          timeGraphData.push({data:tempData, label:pattern+'-'+time});
          basic_time(document.getElementById('example'));
        });
        addPatternBlock(pattern+'-'+time);
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
        case 'timeCount':
        basic_time(document.getElementById("example"));
        break;
      }
    });

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
        points:{show:true}, 
        lines:{show:true},
        mouse: {
          track:true,
          trackFormatter: function(obj) {
            return obj.y; 
          },
          relative: true 
        },
        selection : {
          mode : 'x'
        },
        HtmlText : false,
        title : 'Time'
      };

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
  }

  var senecaMsgStatsModule = angular.module('senecaMsgStatsModule', ['angularLoad', 'angucomplete']);
  senecaMsgStatsModule.directive('senecaMsgStats', ['$http','$window', '$q', function($http, $window, $q) {
    var def = {
      restrict:'A',
      scope:{
      },
      controller: msgStatsController,
      link: function ($scope, element, attrs) {
        http = $http;
      },
      templateUrl:prefix+"/_msg_stats_template.html"
    }
    return def
  }])


}.call(window,angular,moment));
