// var d3 = require('d3');

require('./d3Line.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 20, right: 30, bottom: 30, left: 40}; 

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
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);

  var x = d3.time.scale()
          .range([0, width]);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  var parseDate = d3.time.format("%d-%b-%y").parse;
  var line = d3.svg.line()
               .x(function(d) {return scales.x(d.date); })
               .y(function(d) {return scales.y(d.close); });


  d3.csv(props.csv, type, function (error, data) {
    if (error) throw err;

    scales.x.domain(d3.extent(data, function(d) {return d.date; }));
    scales.y.domain(d3.extent(data, function(d) {return d.close; }));

    var chart = d3.select(el).select('.chart');

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
      .text('Profit ($)');

      // data join (enter only)
      chart.append('path')
        .datum(data)
        .attr('class', 'line')
        .attr('d', line);


  });

  function type(d) {
    d.date = parseDate(d.date);
    d.close = +d.close; //coerce to number
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
