require('./d3Pos.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 90, bottom: 60, left: 70}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {
  container = d3.select(el).append('div')
    .attr('class', 'rel')
    .style('width', props.width + "px")
    .style('height', props.height + "px")


  container.append('div')
  .attr('class', 'abs')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
  .style('left', this._margin.left + "px")
  .style('top', this._margin.top + "px")
    .append('canvas')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
    .attr('class', 'image abs');

  container.append('div')
  .attr('class', 'abs')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
  .style('left', this._margin.left + "px")
  .style('top', this._margin.top + "px")
    .append('canvas')
    .style('width', this._width(props) + "px")
    .style('height', this._height(props) + "px")
    .attr('class', 'heatmap abs')
    .classed('pixelated', props.pixelated);

 container.append('svg')
    .attr('class', 'abs')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');


  this.update(el, props, state);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .tickValues([1,2,3,4,5,6])
              .tickFormat(d3.format("d"))
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .tickValues([1,2,3,4,5,6])
              .tickFormat(d3.format("d"))
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
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
      color = d3.scale.linear()
                  .domain(colorDomain)
                  // .range(["#000000","#ffffff"].reverse());
                  .range(["#000000","#ffffff"]);
    } else {
      color = d3.scale.linear()
                  .domain(colorDomain)
                  .range(colorRange);
    }

    var chart = d3.select(el).select('.chart');

    // chart.append('g')
    //     .attr('transform', 'translate(' + width/2 + ',' + height +  ')')
    //     .append('text')
    //     .attr('class', 'axis')
    //     .attr('text-anchor', 'middle')
    //     .attr("dy", "2.35em")
    //     .text('Width');

    // chart.append('g')
    //     .attr('transform', 'translate(' + -70 + ',' + height/2 +  ')')
    //     .append('text')
    //     .attr('class', 'axis')
    //     .attr('text-anchor', 'middle')
    //     .attr('transform', 'rotate(-90)')
    //     .attr("dy", "2.35em")
    //     .text('Height');
        
    var heatmap = d3.select(el).select('.heatmap')
        .attr('width', dx)
        .attr('height', dy)
        .call(function() { drawImageRowBlock(this, data, props.yblock, props.xblock);});


    var every15 = Array.apply(null, Array(255/15 + 1)).map(function(_, i) {return i * 15;}).reverse();

    if (props.legend) {
      box = 25;
      var legend = chart.selectAll('.legend')
            .data(color.ticks(10).reverse())
            // .data(every15)
            .enter().append('g')
            .attr('class', 'legend')
            .attr('transform', function(d, i) {return 'translate(' + (width + box) + ',' + (i *box) + ')';});


      legend.append("rect")
        .attr("width", box)
        .attr("height", box)
        .style("stroke", function (d) { return "black";})
        .style("fill", color)

      var legendFormat = d3.format();
      if(props.percent) {
        legendFormat = d3.format('%');
      }

      legend.append("text")
        .attr("x", box+6)
        .attr("y", 10)
        .attr("dy", ".35em")
        .text(function(d) {return legendFormat(d);});
    }

    if (props.grid) {
      if (props.axis) {
        chart.append('g')
          .attr('class', 'x axis')
          .attr("transform", "translate("+width/2/(data[0].length)+", " + height + ")")
          .call(axis.x);

        chart.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(0, "  + - height/2/data.length + ")")
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
           "x2" : width,
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

};

ns.destroy = function(el) {};

module.exports = ns;
