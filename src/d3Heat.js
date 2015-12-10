// var d3 = require('d3');

require('./d3Bar.less');
require('./d3Tile.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 90, bottom: 30, left: 50}; 

ns._width = function(props) {
  return props.width - this._margin.left - this._margin.right;
}

ns._height = function(props) {
  return props.height - this._margin.top - this._margin.bottom;
}

ns.create = function(el, props, state) {

  d3.select(el).append('svg')
    .attr('width', props.width)
    .attr('height', props.height)
    .append('g')
    .attr('class', 'chart')
    .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._axis = function(scales) {
  var formatDate = d3.time.format("%b %d");
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom')
              .ticks(d3.time.days)
              .tickFormat(formatDate);

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var z = d3.scale.linear()
          .range(["white", "steelblue"]);
  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.time.scale()
          .range([0, width]);

  return {x: x, y: y, z: z};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);
  var parseDate = d3.time.format("%Y-%m-%d").parse;
  var xStep = 864e5,
      yStep = 100;

  d3.csv(props.csv, type, function (error, data) {
    if (error) throw error;

    scales.x.domain(d3.extent(data, function(d) {return d.date; }));
    scales.y.domain(d3.extent(data, function(d) {return d.bucket; }));
    scales.z.domain([0, d3.max(data, function(d) { return d.count; })]);

    scales.x.domain([scales.x.domain()[0], +scales.x.domain()[1] + xStep]);
    scales.y.domain([scales.y.domain()[0], +scales.y.domain()[1] + yStep]);

    var chart = d3.select(el).select('.chart');



    // data join (enter only)
    var tile = chart.selectAll('.tile')
           .data(data)
           .enter().append('rect')
           .attr('class', 'tile')
           .attr("x", function(d) { return scales.x(d.date); })
           .attr("y", function(d) { return scales.y(d.bucket + yStep); })
           .attr("width", scales.x(xStep) - scales.x(0))
           .attr("height", scales.y(0) - scales.y(yStep) )
           .style('fill', function(d) { return scales.z(d.count); });

    var legend = chart.selectAll('.legend')
          .data(scales.z.ticks(6).slice(1).reverse())
          .enter().append('g')
          .attr('class', 'legend')
          .attr('transform', function(d, i) {return 'translate(' + (width +20) + ',' + (20 + i *20) + ')';});

    legend.append("rect")
      .attr("width", 20)
      .attr("height", 20)
      .style("fill", scales.z);

    legend.append("text")
      .attr("x", 26)
      .attr("y", 10)
      .attr("dy", ".35em")
      .text(String);

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Value');

  });

  function type(d) {
    d.date = parseDate(d.date);
    d.bucket = +d.bucket;
    d.count = +d.count; //coerce to number
    return d;
  }

  function add_percent(d, n) {
    percent = +(d.split("%")[0])
    newPercent = percent + n
    return "" + newPercent + "%";
  }
};

ns.destroy = function(el) {};

module.exports = ns;
