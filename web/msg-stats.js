;(function(angular,moment) {
  "use strict";

  var root = this
  var seneca = root.seneca
  var prefix = (seneca.config.msgstats ? seneca.config.msgstats.prefix : null ) || '/msgstats'
  var adminprefix = (seneca.config.admin ? seneca.config.admin.prefix : null ) || '/admin'
  var chartData;
  var data;
  var selectedPatterns = [];

  
  var getDataCallback = function(err, response) {
    data = new google.visualization.DataTable();
    data.addColumn('string', 'Action');
    data.addColumn('number', 'Count');
    updateGoogleChart(response);
  } 

  var queryDataCallback = function(err, response) {
    updateChart(response);
  } 

  function updateChart(resp) {
    var response = resp;
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
      data: {actions:pattern,type:'normal'},
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

  function queryInfluxDBTime(pattern,cb) {
    var result = [];
    $.ajax({
      url: "/influxdb/queryInflux",
      type: 'get',
      data: {actions:pattern,type:'time'},
      dataType:'json'
    }).success(function(data) {
      if(data.length > 0) {
        var response = parseInfluxTimeData(data);
        console.log("queryInfluxDBTime Respone = " + JSON.stringify(response));
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
        /*var containsRole = _.contains(countedRoles,points[i][timeIndex]);
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
        }*/

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
        var barTicks = [],
            intValues = [],
            barData = [],
            barLabels = [],
            intvalue, i, maxNum;
        var counter = 0;

        $("#pattern_form").submit(function( event ) {
          var pattern = $('#pattern_text').val();
          $("#example").show();
          basic_time(pattern,document.getElementById("example"));
          event.preventDefault();
        });

        loadSenecaPatternsList();

        $("#chartType").change(function(event) {
          var val = $("#chartType").val();
          barTicks = [];
          intValues = [];
          barData = [];
          barLabels = [];
          
          $(":checkbox").prop('checked', false);
          switch (val) {
            case 'actionCount':
            $("#example").show();
            basic(document.getElementById("example"),[],[],[],0);
            break;
            case 'timeCount':
            console.log("time count called");
            //$("#example").hide();
            //$("#pattern_form").show();
            basic_time('',document.getElementById("example"));
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

        function createPatternCheckboxes(data) {
          for(var i = 0; i<data.length;i++) {
            $("#patterns_list").append('<label for="checkbox'+i+'" class="pattern_label"><input id="checkbox'+i+'" class="pattern_checkbox" type="checkbox" />'+JSON.stringify(data[i])+'</label><br>');  
          }

          $('.pattern_checkbox').change(function() {
            var chartType = $("#chartType").val();
            selectedPatterns = [];
            if(this.checked) {
              //console.log("checked", $("label[for='"+this.id+"']").text());
              selectedPatterns.push( $("label[for='"+this.id+"']").text() );
              var pattern = $("label[for='"+this.id+"']").text();
              pattern = pattern.replace('{','');
              pattern = pattern.replace('}','');
              pattern = pattern.replace(/["']/g, "");

              if(chartType === 'actionCount') {
                queryInfluxDB(pattern,function(err, response) {
                  console.log("queryInfluxDB response text = " + response);
                  for(var i = 0; i<response.length;i++) {
                    barTicks.push([counter, response[i][0] ]);
                    var intvalue = response[i][1];
                    intValues.push(intvalue);
                    barData.push([ intvalue, counter]);
                    barLabels.push([counter, intvalue + '<br />'+barTicks[i][1]]);
                    counter++;

                  }
                  maxNum = _.max(intValues);
                  console.log(barData);
                  drawBars(document.getElementById('example'), barData, barTicks, barLabels, maxNum);
                });
              } else {
                $("input:checkbox").prop("checked", false);
                $(this).prop("checked", true);
                basic_time(pattern,document.getElementById('example'));
              }
            } else {
              var patternUnchecked = $("label[for='"+this.id+"']").text();
              patternUnchecked = patternUnchecked.replace('{','');
              patternUnchecked = patternUnchecked.replace('}','');
              patternUnchecked = patternUnchecked.replace(/["']/g, "");
              var elementRemoved = false;
              if(chartType === 'actionCount') {

                for(var i = barData.length-1; i >= 0; i--) {
                  console.log("i == " + barTicks[i]);
                  if(barTicks[i][1] === patternUnchecked) {
                    barData.splice(i,1);
                    barTicks.splice(i,1);
                    barLabels.splice(i,1);
                    elementRemoved = true;
                  }
                }

                if(elementRemoved) {
                  for(var i = 0; i < barData.length; i++) {
                    barData[i][1] = i;
                    barTicks[i][0] = i;
                    barLabels[i][0] = i;
                  }
                  counter = barData.length;
                }

                drawBars(document.getElementById('example'), barData, barTicks, barLabels, maxNum);
              } else {
                basic_time('',document.getElementById('example'));
              }
            }
          });

        }

        function basic_time(pattern, container) {
            var
              d1    = [],
              options,
              graph,
              x, o;

            queryInfluxDBTime(pattern,function(err, response) {
              for(var i = 0; i<response.length;i++) {
                          //time, count
                d1.push([ response[i][1], response[i][0] ]);
              }
              graph = drawGraph(); 
            });
               
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

            // Draw graph with default options, overwriting with passed options
            function drawGraph (opts) {
              console.log("drawGraph called");
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
        function basic(container, barData, barTicks, barLabels, maxNum) {

            //var
             // barData = [],
             // barTicks = [],
             // barLabels = [],
             // intValues=[],
             // i, graph, maxNum;
              /*getData(function(err, response) {
                
                for(var i = 0; i<response.length;i++) {
                  barTicks.push([i, response[i][0] ]);
                  var intvalue = response[i][1];
                  intValues.push(intvalue);
                  barData.push([ intvalue, i]);
                  barLabels.push([i, intvalue + '<br />'+barTicks[i][1]]);
                }

                maxNum = _.max(intValues);
                drawBars(container, barData,  barTicks, barLabels, maxNum);  
            });   */  
              //maxNum = _.max(intValues);
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
          basic(document.getElementById("example"),[],[],[],0);
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
