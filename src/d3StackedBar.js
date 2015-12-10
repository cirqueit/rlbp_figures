// var d3 = require('d3');

require('./d3Legend.less');
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

ns._color = function() {
  var color = d3.scale.ordinal()
              .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
  return color;
}
ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left')
              .tickFormat(d3.format('.2s'));

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
  var color = this._color();

  d3.csv(props.csv, function (error, data) {
    if (error) throw err;

    color.domain(d3.keys(data[0]).filter(function(key) { return key !== 'State';}));

    data.forEach(function(d) {
      var y0 = 0;
      d.ages = color.domain().map(function(name) { return {name:name, y0:y0, y1: y0 += +d[name]};});
      d.total = d.ages[d.ages.length -1].y1;
    });

    data.sort(function(a, b) { return b.total - a.total; });

    scales.x.domain(data.map(function(d) {return d.State; }));
    scales.y.domain([0, d3.max(data, function(d) { return d.total; })]);

    var chart = d3.select(el).select('.chart');

    chart.append('g')
      .attr('class', 'x axis')
      .attr("transform", "translate(0, " + height + ")")
      .call(axis.x);

    chart.append("g")
      .attr("class", "y axis")
      .attr("transform", "translate(" + - 3 + ",0)")
      .call(axis.y)
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 6)
      .attr('dy', '.71em')
      .style('text-anchor', 'end')
      .text('Population');


    // data join (enter only)
    var state = chart.selectAll('.state')
           .data(data)
           .enter().append('g')
           .attr('class', 'state')
           .attr('transform', function(d) { return "translate(" + scales.x(d.State) + ", 0)"; });

    state.selectAll('rect')
        .data(function(d) {return d.ages;})
        .enter().append('rect')
        .attr("width", scales.x.rangeBand())
        .attr("y", function(d) { return scales.y(d.y1); })
        .attr("height", function(d) { return scales.y(d.y0) - scales.y(d.y1); })
        .style('fill', function(d) { return color(d.name); });

    var legend = chart.selectAll('.legend')
        .data(color.domain().slice().reverse())
        .enter().append('g')
        .attr('class', 'legend')
        .attr('transform', function(d, i) { return 'translate(0, ' + i * 20 + ')'; });

    legend.append('rect')
      .attr('x', width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', color)
    legend.append('text')
        .attr("x", width - 24)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function(d) {return d; });
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
