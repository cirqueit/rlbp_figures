// var d3 = require('d3');

require('./d3HBar.less');
require('./d3HAxis.less');

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
      .attr('height', props.width)
      .append('g')
      .attr('class', 'chart')
      .attr('transform', 'translate(' + this._margin.left + ',' + this._margin.top + ')');

  this.update(el, props);
}

ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom')
              .ticks(10, '%');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left');

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var x = d3.scale.linear()
          .range([0, width]);
  var y = d3.scale.ordinal()
          .rangeRoundBands([0, height], .1);

  return {x: x, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);

  d3.csv(props.csv, type, function (error, data) {
    scales.x.domain([0, d3.max(data, function(d) { return d.value; })]);
    scales.y.domain(data.map(function(d) {return d.name; }));

    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x haxis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x)
      .append('text')
      .attr('y', 6)
      .attr('dy', '.35em')
      .style('text-anchor', 'middle')
      .text('Frequency');

    chart.append("g")
      .attr("class", "y haxis")
      .call(axis.y);

    // data join (enter only)
    var bar = chart.selectAll('.hbar')
           .data(data)
           .enter().append('g')
           .attr('class', 'hbar')
           .attr('transform', function(d) { return "translate(0," + scales.y(d.name) + ")"; });

    bar.append('rect')
        .attr("width", function(d) { return scales.x(d.value); })
        .attr("height", scales.y.rangeBand());

    bar.append('text')
        .attr("x", function(d) { return scales.x(d.value) - 3; })
        .attr("y", scales.y.rangeBand() / 2)
        .attr("dy", ".35em")
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
