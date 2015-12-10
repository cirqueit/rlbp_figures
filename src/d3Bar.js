// var d3 = require('d3');

require('./d3Bar.less');
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
              .orient('left')
              .ticks(10, '%');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.linear()
          .range([height, 0]);
  var x = d3.scale.ordinal()
          .rangeRoundBands([0, width], .1);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  d3.csv(props.csv, type, function (error, data) {

    scales.x.domain(data.map(function(d) {return d.name; }));
    scales.y.domain([0, d3.max(data, function(d) { return d.value; })]);
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
      .text('Frequency');


    // data join (enter only)
    var bar = chart.selectAll('.bar')
           .data(data)
           .enter().append('g')
           .attr('class', 'bar')
           .attr('transform', function(d, i) { return "translate(" + scales.x(d.name) + ", 0)"; });

    bar.append('rect')
        .attr("y", function(d) { return scales.y(d.value); })
        .attr("height", function(d) { return height - scales.y(d.value); })
        .attr("width", scales.x.rangeBand() - 1);

    bar.append('text')
        .attr("x", scales.x.rangeBand() / 2)
        .attr("y", function(d) { return scales.y(d.value) + 3; })
        .attr("dy", ".75em")
        .text(function(d) {return Math.round(d.value * 1000)/10.0;});
  });

  function type(d) {
    d.value = +d.value; //coerce to number
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
