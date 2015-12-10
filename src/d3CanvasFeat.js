// var d3 = require('d3');

require('./d3Pos.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 90, bottom: 30, left: 50}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns._img = new Image(),
ns._imgReady = false,

ns.create = function(el, props, state) {
  console.log(ns._imgReady);
  ns._img.onload = function() {
    ns._imgReady = true;
    console.log(ns._imgReady);
  }
  ns._img.src = 'lenna.png';

  container = d3.select(el).append('div')
    .attr('class', 'rel')
    .style('width', props.width + "px")
    .style('height', props.height + "px")


  // container.append('div')
  // .attr('class', 'abs')
  //   .style('width', this._width(props) + "px")
  //   .style('height', this._height(props) + "px")
  // .style('left', this._margin.left + "px")
  // .style('top', this._margin.top + "px")
  //   .append('canvas')
  //   .style('width', this._width(props)/2 + "px")
  //   .style('height', this._height(props) + "px")
  //   .attr('class', 'image abs');

  factor = 1.33;
  img_width = 299;
  img_height = 219;

    dots = container.append('div')
    .attr('class', 'abs')
      .style('width', this._width(props) + "px")
      .style('height', this._height(props) + "px")
      .style('left', this._margin.left + "px")
      // .style('top', this._margin.top + img_height_offset + "px")
      .style('top',  img_height_offset + "px")
    .append('svg')
      .attr('height', this._height(props) + "px")
      .attr('class', 'abs');

     dots.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.70em')
      .attr('dx', '-.2em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('...');

     dots.append('text')
      .attr('x', 0)
      .attr('y', this._height(props) - 33)
      .attr('dy', '.81em')
      .attr('dx', '-.2em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('...');

  for (var i = 0; i < 3; i++ ) {
    var img_height_offset = 0;
    for (var k = 0; k < i; k++ ) {
      img_height_offset += img_height/Math.pow(factor, k);
    }


    container.append('div')
    .attr('class', 'abs')
      .style('width', this._width(props) + "px")
      .style('height', this._height(props) + "px")
    .style('left', this._margin.left + "px")
    .style('top', this._margin.top + img_height_offset + "px")
      .append('img')
      .attr('src', "lenna.png")
      .style('width', img_width/Math.pow(factor,i) + "px")
      .style('height', img_height/Math.pow(factor,i) + "px")
      .attr('class', 'abs');
  }

 container.append('svg')
    .attr('class', 'abs')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

search_container =  container.append('div')
  .attr('class', 'abs')
    .style('width', props.search.w + "px")
    .style('height', props.search.h + "px")
  .style('left', this._margin.left + props.search.x + "px")
  .style('top', this._margin.top + props.search.y + "px");

search_container.append('canvas')
    .style('width', props.search.w + "px")
    .style('height', props.search.h + "px")
    .attr('class', 'heatmap abs')
    .classed('pixelated', props.pixelated);

search_container.append('svg')
    .style('width', props.search.w + "px")
    .style('height', props.search.h + "px")
    .attr('class', 'search abs')
    .classed('pixelated', props.pixelated);

feature_y_offset = 140;

stage_container =  container.append('div')
  .attr('class', 'abs')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
  .style('left', this._margin.left + props.feature.x + "px")
  .style('top', this._margin.top + props.feature.y  + "px");

stage_container.append('svg')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
    .attr('class', 'stage abs')
    .classed('pixelated', props.pixelated);

feature_container =  container.append('div')
  .attr('class', 'abs')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
  .style('left', this._margin.left + props.feature.x + "px")
  .style('top', this._margin.top + props.feature.y  + feature_y_offset + "px");

feature_container.append('svg')
    .style('width', props.feature.w + "px")
    .style('height', props.feature.h + "px")
    .attr('class', 'feature abs')
    .classed('pixelated', props.pixelated);

  this.update(el, props, state);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .tickValues([1,2,3,4,5,6])
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .tickValues([1,2,3,4,5,6])
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props)/3;
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.scale.linear()
          .range([0, width]);

  return {x: x, y: y};
}

ns.update = function(el, props, state) {
  var margin = this._margin;
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  var data = null
  if (state.data && state.data.length > 0 && Array.isArray(state.data[0])) {
    data = state.data;
  } else {
    for (var i in state.data) {
      if (state.data[i].scale == props.scale) {
        data = state.data[i].data;
      }
    }
  }


  if (data) {

    if (props.percent) {
      var sum = d3.sum(data, function(d) { return d3.sum(d); });
      data = data.map(function(d) { return d.map(function(d) {return 1.0 * d / sum;}); });
      data = data.reverse();
    }

    var dx = data[0].length;
    var dy = data.length;

    var start = 1;
    scales.x.domain([start, dx+start]);
    scales.y.domain([start, dy+start]);

    var colorDomain = [0, d3.max(data, function(d) { return d3.max(d);})];
    if (props.percent) {
      colorDomain = [0, 0.05, 1];
      colorRange = ['rgb(255,255,255)','rgb(255,255,217)','rgb(237,248,177)','rgb(199,233,180)','rgb(127,205,187)','rgb(65,182,196)','rgb(29,145,192)','rgb(34,94,168)','rgb(37,52,148)','rgb(8,29,88)'];
      colorRange = ['rgb(255,255,255)', 'rgb(127,205,187)', 'rgb(8,29,88)'];
    }
    var color;
    if (props.grey) {
      color = d3.scale
                  // .pow().exponent(2)
                  .linear()
                  // .domain(colorDomain)
                  // .range(["#000000","#ffffff"].reverse());
                  .domain([1, 255])
                  .range(["#000000","#ffffff"]);
    } else {
      color = d3.scale.linear()
                  .domain(colorDomain)
                  .range(colorRange);
    }

    var chart = d3.select(el).select('.chart');
    // chart.append('text').attr('class', 'axis').text(function() { var a = []; for(i=0; i<20; i++) {a.push('0, ');} return 'LUT= [ ' + a.join('').slice(0,-2) +' ]';});

    var window = chart.selectAll('.window')
         .data([state.location]);
    
    window_enter = window.enter().append('g')
      .attr('class', 'window')

    window_enter.append('rect');
    window_enter.append('line')
       .attr('class', 'line0');
    window_enter.append('line')
       .attr('class', 'line1');
    window_enter.append('line')
       .attr('class', 'line2');
    window_enter.append('line')
       .attr('class', 'line3');
    window_enter.append('polygon')
       .attr('class', 'polygon0')
    window_enter.append('polygon')
       .attr('class', 'polygon1')
    window_enter.append('polygon')
       .attr('class', 'polygon2')
    window_enter.append('polygon')
       .attr('class', 'polygon3');

    window.select('rect')
      .attr('x', function(d) {return d.x})
      .attr('y', function(d) {return d.y})
      .attr('width', function(d) {return d.w})
      .attr('height', function(d) {return d.h})
      .attr('fill', 'white')
      .attr('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon0')
      .attr('points', function(d) {
        var x0 = d.x;
        var y0 = d.y + d.h;
        var x1 = props.search.x;
        var y1 = props.search.y + props.search.h;
        var x2 = props.search.x + props.search.w;
        var y2 = props.search.y + props.search.h;
        var x3 = d.x + d.w;
        var y3 = d.y + d.h;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon1')
      .attr('points', function(d) {
        var x0 = d.x + d.w;
        var y0 = d.y + d.h;
        var x1 = props.search.x + props.search.w;
        var y1 = props.search.y + props.search.h;
        var x2 = props.search.x + props.search.w;
        var y2 = props.search.y;
        var x3 = d.x + d.w;
        var y3 = d.y;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon2')
      .attr('points', function(d) {
        var x0 = d.x + d.w;
        var y0 = d.y;
        var x1 = props.search.x + props.search.w;
        var y1 = props.search.y;
        var x2 = props.search.x;
        var y2 = props.search.y;
        var x3 = d.x;
        var y3 = d.y;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    window.select('.polygon3')
      .attr('points', function(d) {
        var x0 = d.x;
        var y0 = d.y;
        var x1 = props.search.x;
        var y1 = props.search.y;
        var x2 = props.search.x;
        var y2 = props.search.y + props.search.h;
        var x3 = d.x;
        var y3 = d.y + d.h;
        return x0+','+y0+' '+ x1+','+y1+' '+ x2+','+y2+' '+ x3+','+y3;
      })
      .attr('fill', 'purple')
      .attr('fill-opacity', 0.2)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 0.5);

    // window.select('.line0')
    //   .attr('x1', function(d) {return d.x})
    //   .attr('y1', function(d) {return d.y})
    //   .attr('x2', function(d) {return props.search.x + "px"})
    //   .attr('y2', function(d) {return props.search.y + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    // window.select('.line1')
    //   .attr('x1', function(d) {return d.x+d.w})
    //   .attr('y1', function(d) {return d.y})
    //   .attr('x2', function(d) {return props.search.x + props.search.w + "px"})
    //   .attr('y2', function(d) {return props.search.y + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    // window.select('.line2')
    //   .attr('x1', function(d) {return d.x+d.w})
    //   .attr('y1', function(d) {return d.y+d.h})
    //   .attr('x2', function(d) {return props.search.x + props.search.w + "px"})
    //   .attr('y2', function(d) {return props.search.y + props.search.h + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    // window.select('.line3')
    //   .attr('x1', function(d) {return d.x})
    //   .attr('y1', function(d) {return d.y+d.h})
    //   .attr('x2', function(d) {return props.search.x + "px"})
    //   .attr('y2', function(d) {return props.search.y + props.search.h + "px"})
    //   .style('stroke', 'black')
    //   .style('stroke-width', '2px')
    //   .style('stroke-opacity', 0.5);

    window.exit().remove();

    var heatmap = d3.select(el).selectAll('.heatmap')
        .each(function(d) {
          d3.select(this)
          .attr('width', dx)
          .attr('height', dy)
          // .call(function() { drawImageRowBlock(this, data, props.yblock, props.xblock);});
          .call(function() { drawSearchWindow(this, img_width, img_width, factor, 0, state.location);});
        });

    var searchmap = d3.select(el).selectAll('.search');

    searchmap.append('rect')
        .attr('x', function(d) {return 0})
        .attr('y', function(d) {return 0})
        .attr('width', function(d) {return props.search.w})
        .attr('height', function(d) {return props.search.h})
        .style('stroke', 'black')
        .style('stroke-width', '8px')
        .style('fill-opacity', 0.0)
        .style('stroke-opacity', 1.0);

    var cell_width = 2;
    var cell_height = 2;
    var x_offset = 6;
    var y_offset = 4;

    // searchmap
    searchmap.append('text')
      .attr('x', props.search.w/20 * (x_offset - 2))
      .attr('y', props.search.h/20 * (y_offset - 1.6))
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('(x,y)');

    searchmap.append('text')
      .attr('x', props.search.w/20 * (x_offset + cell_width*3))
      .attr('y', props.search.h/20 * (y_offset + cell_height))
      .attr('dy', '.91em')
      .attr('dx', '.3em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('3h');

    searchmap.append('text')
      .attr('x', props.search.w/20 * (x_offset + cell_width*1))
      .attr('y', props.search.h/20 * (y_offset + cell_height*3))
      .attr('dy', '.98em')
      .attr('dx', '.2em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('3w');

    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*2),
           "x2" : props.search.w/20 * (x_offset + cell_width*3),
           "y1" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "y2" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });
    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*0),
           "x2" : props.search.w/20 * (x_offset + cell_width*1),
           "y1" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "y2" : props.search.w/20 * (y_offset + cell_height*3) + 10,
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });
    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "x2" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "y1" : props.search.w/20 * (y_offset + cell_height*0),
           "y2" : props.search.w/20 * (y_offset + cell_height*1),
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });
    searchmap.append('line')
      .attr({
           "x1" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "x2" : props.search.w/20 * (x_offset + cell_width*3) + 10,
           "y1" : props.search.w/20 * (y_offset + cell_height*2),
           "y2" : props.search.w/20 * (y_offset + cell_height*3),
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
       });

    lb = searchmap.selectAll('.lbp').data([0,0,0,0,0,0,0,0,0])
    lb.enter().append('rect')
      .attr('class', 'lbp')
      .attr('x', function(d, i) {return props.search.w/20 * (cell_width*((i%3)) + x_offset)})
      .attr('y', function(d, i) {return props.search.h/20 * (cell_height*(Math.floor(i/3)) + y_offset)})
      .attr('width', function(d) {return props.search.w/20 * cell_width})
      .attr('height', function(d) {return props.search.h/20 * cell_height})
      .style('fill', 'white')
      .style('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 1.0);

    lb.exit().remove();
    // for (var j = 0; j < 3; j++) {
    //   for (var i = 0; i < 3; i++) {
    //     searchmap.append('rect')
    //         .attr('x', function(d) {return props.search.w/20 * (cell_width*i + x_offset)})
    //         .attr('y', function(d) {return props.search.w/20 * (cell_height*j + y_offset)})
    //         .attr('width', function(d) {return props.search.w/20 * cell_width})
    //         .attr('height', function(d) {return props.search.h/20 * cell_height})
    //         .style('fill', 'white')
    //         .style('fill-opacity', 0.5)
    //         .style('stroke', 'black')
    //         .style('stroke-width', '2px')
    //         .style('stroke-opacity', 1.0);
    //   }
    // }
    x_edge = 60;
    x_next = x_edge + 20;
    y_start = 320;
    y_line = 24;

    var stage = d3.select(el).selectAll('.stage');

    stage.append('text')
      .attr('x', 0)
      .attr('y', 0)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('stage: 2/50, feature: 5/10');

    // stage.append('text')
    //   .attr('x', 0)
    //   .attr('y', y_line * 1.4)
    //   .attr('dy', '.81em')
    //   .attr('dx', '.1em')
    //   .style('text-anchor', 'start')
    //   .style('font-size', '24px')
    //   .text('feature: 5/10');

    stage.append('text')
      .attr('x', 0)
      .attr('y', y_line * 1.4*1)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('x: 10, y: 10, w: 2, h: 2');

    stage.append('text')
      .attr('x', 0)
      .attr('y', y_line * 1.4*2)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '24px')
      .text('LUT: [0,0,1,0,1,1,1,0,...');


    var feature = d3.select(el).selectAll('.feature');
    // feature.append('rect')
    //     .attr('x', function(d) {return 0})
    //     .attr('y', function(d) {return 0})
    //     .attr('width', function(d) {return props.feature.w})
    //     .attr('height', function(d) {return props.feature.h})
    //     .style('stroke', 'black')
    //     .style('stroke-width', '8px')
    //     .style('fill-opacity', 0.0)
    //     .style('stroke-opacity', 1.0);

    var labels = [
        {x: 0, y: 0,                                 label: 1},
        {x: props.feature.w/2, y: 0,                 label: 2},
        {x: 0, y: props.feature.h/2,                 label: 3},
        {x: props.feature.w/2, y: props.feature.h/2, label: 4},
    ];
    var radius = 20;
    var offset = 12;

    feature_enter = feature.selectAll('.step').data(labels)
      .enter().append('g')
      .attr('class', 'step')
      .attr('transform', function(d) { 
        var x = d.x + radius + offset;
        var y = d.y + radius + offset;
        return 'translate(' + x + ', ' + y + ')'})


        // feature_enter.append('circle')
        // .attr('r', function(d) {return radius})
        // .style('fill', 'white')
        // .style('stroke', 'black')
        // .style('stroke-width', '4px');

        feature_enter.append('text')
          .attr('y', - radius)
          .attr('dy', '.71em')
          .style('text-anchor', 'middle')
          .text(function(d, i) { return i + 1});

    var lbp1 = [0, 0, 200,
                40, 100, 40,
                160,  160 ,160];
    f1 = feature.selectAll('.fig1').data(lbp1)
      .enter().append('g')
      .attr('class', 'fig1')
      .attr('transform', 'translate('+80 + ', ' + 80+')');

      f1.append('rect')
      .attr('x', function(d, i) {return props.feature.w/24 * (cell_width*(i%3))})
      .attr('y', function(d, i) {return props.feature.w/24 * (cell_height*Math.floor(i/3))})
      .attr('width', function(d) {return props.feature.w/24 * cell_width})
      .attr('height', function(d) {return props.feature.h/24 * cell_height})
      .style('fill', function(d) {return d3.rgb(d,d,d);})
      .style('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 1.0)

    var lbp2 = [0, 0, 1,
                0, ' ', 0,
                1,  1 ,1];

    f2 = feature.selectAll('.fig2').data(lbp2)
      .enter().append('g')
      .attr('class', 'fig2')
      .attr('transform', 'translate('+340 + ', ' + 80+')');

      f2.append('rect')
      .attr('x', function(d, i) {return props.feature.w/24 * (cell_width*(i%3))})
      .attr('y', function(d, i) {return props.feature.w/24 * (cell_height*Math.floor(i/3))})
      .attr('width', function(d) {return props.feature.w/24 * cell_width})
      .attr('height', function(d) {return props.feature.h/24 * cell_height})
      .style('fill', 'white')
      .style('fill-opacity', 0.5)
      .style('stroke', 'black')
      .style('stroke-width', '2px')
      .style('stroke-opacity', 1.0)

      f2.append('text')
        .attr('x', function(d, i) {return props.feature.w/24 * (cell_width*(i%3))})
        .attr('y', function(d, i) {return props.feature.w/24 * (cell_height*Math.floor(i/3))})
        .attr('dy', '1.2em')
        .attr('dx', '0.4em')
        .style('font-size', '24px')
        .style('text-anchor', 'start')
        .text(function(d) { return d});


    feature.append('text')
      .attr('x', 320)
      .attr('y', 220)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16px')
      .text('"00101110" == 56');

    
    feature.append('text')
      .attr('x', x_edge)
      .attr('y', y_start)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('if (LUT[56]) {');

    feature.append('text')
      .attr('x', x_next)
      .attr('y', y_start + y_line*1)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text(' VALUE = PASS');

    feature.append('text')
      .attr('x', x_edge)
      .attr('y', y_start + y_line*2)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('} else {');

    feature.append('text')
      .attr('x', x_next)
      .attr('y', y_start + y_line*3)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text(' VALUE = FAIL');

    feature.append('text')
      .attr('x', x_edge)
      .attr('y', y_start + y_line*4)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('}');


    feature.append('text')
      .attr('x', 320)
      .attr('y', y_start + y_line*1)
      .attr('dy', '.81em')
      .attr('dx', '.1em')
      .style('text-anchor', 'start')
      .style('font-size', '16')
      .text('STAGE += VALUE');

    var every15 = Array.apply(null, Array(255/15 + 1)).map(function(_, i) {return i * 15;}).reverse();

    if (props.legend) {
      var legend = chart.selectAll('.legend')
            .data(color.ticks(10).reverse())
            // .data(every15)
            .enter().append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) {return 'translate(' + (width + 20) + ',' + (10 + i *20) + ')';});


      legend.append("rect")
        .attr("width", 20)
        .attr("height", 20)
        .style("stroke", function (d) { return "black";})
        .style("fill", color)

      var legendFormat = d3.format();
      if(props.percent) {
        legendFormat = d3.format('%');
      }

      legend.append("text")
        .attr("x", 26)
        .attr("y", 10)
        .attr("dy", ".35em")
        .text(function(d) {return legendFormat(d);});
    }

    if (props.grid) {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate("+width/3/2/(data[0].length)+", " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(0, "  + - height/3/data.length + ")")
          .call(axis.y);
      }

    chart.selectAll("line.ygrid")
      .data(scales.y.ticks(6))
    .enter()
      .append("line")
      .attr(
           {
           "class":"ygrid",
           "x1" : 0,
           "x2" : width/2,
           "y1" : function(d){ return scales.y(d);},
           "y2" : function(d){ return scales.y(d);},
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
           });

    chart.selectAll("line.xgrid")
      .data(scales.x.ticks(6))
    .enter()
      .append("line")
      .attr(
           {
           "class":"xgrid",
           "y1" : 0,
           "y2" : height,
           "x1" : function(d){ return scales.x(d);},
           "x2" : function(d){ return scales.x(d);},
           "fill" : "none",
           "shape-rendering" : "crispEdges",
           "stroke" : "black",
           "stroke-width" : "2px"
           });
    } else {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate(0, " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .call(axis.y);
      }
    }
  }

  function drawImage(canvas, data) {
    var context = canvas.node().getContext("2d"),
      image = context.createImageData(dx,dy);
    for (var y = 0, p = -1; y < dy; ++y) {
      for (var x = 0; x < dx; ++x) {
        if(data[y][x] == -1) {
          image.data[++p] = 0;
          image.data[++p] = 0;
          image.data[++p] = 0;
          image.data[++p] = 0;
        } else {
          var c = d3.rgb(color(data[y][x]));
          image.data[++p] = c.r;
          image.data[++p] = c.g;
          image.data[++p] = c.b;
          image.data[++p] = 255;
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawImageRowBlock(canvas, data, yblock,xblock) {
    var total = 0;
    var context = canvas.node().getContext("2d"),
      image = context.createImageData(dx,dy);
    if (yblock == 1 && xblock == 1) {
      for (var y = 0, p = -1; y < dy; ++y) {
        for (var x = 0; x < dx; ++x) {
          if(data[y][x] == -1) {
            image.data[++p] = 0;
            image.data[++p] = 0;
            image.data[++p] = 0;
            image.data[++p] = 0;
          } else {
            var c = d3.rgb(color(data[y][x]));
            image.data[++p] = c.r;
            image.data[++p] = c.g;
            image.data[++p] = c.b;
            image.data[++p] = 255;
          }
        }
      }
    } else {
      for (var y = 0, p = -1; y < dy; y+=yblock) {
        for (var x = 0; x < dx; x+=xblock) {
          var max = 0;
          for (var yb = 0; yb < yblock && yb+y < dy; ++yb) {
            var row_max = 0;
            for (var xb = 0; xb < xblock && xb+x < dx; ++xb) {
              if (data[y+yb][x+xb] > row_max) {
                row_max = data[y+yb][x+xb];
              }
            }
            if (row_max > max) {
              max = row_max;
            }
          }
          for (var yb = 0; yb < yblock && yb+y < dy; ++yb) {
            for (var xb = 0; xb < xblock && xb+x < dx; ++xb) {
              var c = d3.rgb(color(max));
              var pos = (y+yb)*4 * dx + (x+xb)*4;
              image.data[pos++] = c.r;
              image.data[pos++] = c.g;
              image.data[pos++] = c.b;
              image.data[pos++] = 255;
              total += max;
            }
          }
        }
      }
    }
    context.putImageData(image, 0, 0);
  }

  function drawSearchWindow(canvas, orig_w, orig_h, factor, iteration, loc) {
    var scale = Math.pow(factor, iteration);
    var context = canvas.node().getContext("2d");
    context.globalAlpha = 1.0;

    if (ns._imgReady) {
      console.log(ns._imgReady);
      var src = {x: loc.x*scale, y: loc.y*scale, w: loc.w*scale, h: loc.h*scale};
      var dest  = {x: 0, y: 0, w: orig_w, h: orig_h};
      context.drawImage(ns._img, src.x, src.y,
                               src.w, src.h,
                               dest.x, dest.y,
                               dest.w, dest.h);
    }
  }

};

ns.destroy = function(el) {};

module.exports = ns;
