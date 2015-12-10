// var d3 = require('d3');

require('./d3Legend.less');
require('./d3Bar.less');
require('./d3Axis.less');

var ns = {};

ns._margin = {top: 40, right: 20, bottom: 30, left: 60}; 

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
              // .range(["#98abc5", "#8a89a6", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
              .range(["#98abc5", "#7b6888", "#6b486b", "#a05d56", "#d0743c", "#ff8c00"]);
              // .range(["#98abc5", "#7b6888", "#a05d56", "#d0743c", "#ff8c00"]);
  return color;
}
ns._axis = function(scales) {
  var x = d3.svg.axis()
              .scale(scales.x0)
              .orient('bottom');

  var y = d3.svg.axis()
              .scale(scales.y)
              .orient('left')
              .tickValues([1e0, 1e1, 1e2, 1e3, 1e4])
              .tickFormat(d3.format('.s'));
              // .tickFormat(d3.format('.2s'));

  return {x: x, y: y};
}

ns._scales = function(props) {
  width = this._width(props);
  height = this._height(props);

  var y = d3.scale.log()
          .range([height, 0]);

  var x0 = d3.scale.ordinal()
          .rangeRoundBands([0, width], .1);
  var x1 = d3.scale.ordinal();

  return {x0: x0, x1: x1, y: y};
}

ns.update = function(el, props) {
  var width = this._width(props);
  var height = this._height(props);
  var scales = this._scales(props);
  var axis = this._axis(scales);
  var color = this._color();

  d3.csv(props.csv, function (error, data) {
    if (error) throw err;

    var ageNames = d3.keys(data[0]).filter(function(key) { return key !== 'State';});

    data.forEach(function(d) {
      d.ages = ageNames.map(function(name) { return {name: name, value: +d[name]}; });
    });
    

    scales.x0.domain(data.map(function(d) { return d.State; }));
    scales.x1.domain(ageNames).rangeRoundBands([0, scales.x0.rangeBand()]);
    scales.y.domain([d3.min(data, function(d) { return d3.min(d.ages, function(d) {return d.value; }); }), d3.max(data, function(d) { return d3.max(d.ages, function(d) {return d.value; }); })]);
    scales.y.domain([1, d3.max(data, function(d) { return d3.max(d.ages, function(d) {return d.value; }); })]);

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
      .text('ms per frame');


    // data join (enter only)
    var state = chart.selectAll('.state')
           .data(data)
           .enter().append('g')
           .attr('class', 'state')
           .attr('transform', function(d) { return "translate(" + scales.x0(d.State) + ", 0)"; });

    state.selectAll('rect')
        .data(function(d) {return d.ages;})
        .enter().append('rect')
        .attr("width", scales.x1.rangeBand())
        .attr("x", function(d) { return scales.x1(d.name); })
        .attr("y", function(d) { return scales.y(d.value); })
        .attr("height", function(d) { return height - scales.y(d.value); })
        .style('fill', function(d) { return color(d.name); });

    // state.selectAll('text')
    //     .data(function(d) {return d.ages;})
    //     .enter().append('text')
    //     .attr('class', 'axis')
    //     .attr("x", function(d) { return scales.x1(d.name) + scales.x1.rangeBand()/2; })
    //     .attr("y", function(d) { return scales.y(d.value); })
    //     .attr("dy", "-.35em")
    //     .style("text-anchor", "middle")
    //     .text(function(d) {
    //         return d.value;
    //     });

    var legend = chart.selectAll('.legend')
        // .data(color.domain().slice().reverse())
        .data(color.domain().slice())
        .enter().append('g')
        .attr('class', 'legend')
        .attr('transform', function(d, i) { return 'translate(0, ' + i * 20 + ')'; });

        var legend_offset = 20;
    legend.append('rect')
      .attr('x', legend_offset + width - 18)
      .attr('width', 18)
      .attr('height', 18)
      .style('fill', color)
    legend.append('text')
        .attr("x", legend_offset + width - 24)
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
