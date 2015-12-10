// var d3 = require('d3');

require('./d3Letters.less');

var ns = {};

ns.create = function(el, props, state) {
  var svg = d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.height);

  this.update(el, state);
};

ns.update = function(el, state) {
  // data join
  var text = d3.select(el).selectAll('text')
         .data(state.data);

  // update
  text.attr('class', 'update');

  // enter
  text.enter().append('text')
      .attr('class', 'enter')
      .attr('x', function(d, i) { return i * 32; })
      .attr('dy', '.35em');

  // enter + update
  text.text(function(d) {return d; });

  // exit
  text.exit().remove();
};

ns.destroy = function(el) {

};

module.exports = ns;
