// var d3 = require('d3');

// require('./d3Feature.less');
require('./d3Axis.less');

var ns = {};

ns._width = function(props) { return props.width; };
ns._height = function(props) { return props.height; };

ns.create = function(el, props, state) {

  var svg = d3.select(el).append('svg')
      .attr('width', props.width)
      .attr('height', props.height);
  svg.append('defs')
     .append('pattern')
     .attr('id', 'hatch')
     .attr('patternUnits', 'userSpaceOnUse')
     .attr('width', 4)
     .attr('height', 4)
     .append('path')
     .attr('d', 'M-1,1 12, -2 M0,4 14,-4 M3,5 12,-2')
     .attr('stroke', 'black')
     .attr('stroke-width', 1);

  this.update(el, props);
};

ns.update = function(el, props) {
  width = this._width(props);
  height = this._height(props);

  var rect0 = {x: 0, y: 0, w: 30, h: 30, color: "white"};
  var rect1 = {x: 15, y: 15, w: 15, h: 15, color: "black"};
  var rect2 = {x: 0, y: 0, w: 15, h: 15, color: "black"};

  var rect3 = {x: 0, y: 0, w: 40, h: 30, color: "white"};
  var rect4 = {x: 10, y: 0, w: 20, h: 30, color: "black"};

  var rect5 = {x: 0, y: 0, w: 40, h: 40, color: "white"};
  var rect6 = {x: 0, y: 20, w: 40, h: 20, color: "black"};

  var feat0 = {x: 10, y: 20, rects: [rect0, rect1, rect2]};
  var feat1 = {x: 20, y: 60, rects: [rect3, rect4]};
  var feat2 = {x: 50, y: 10, rects: [rect5, rect6]};

  var features1 = [feat0, feat1, feat2];
  var window1 = {x: 40, y: 40, w: 100, h: 100, color: "white", features: features1, text: "a) example Haar features"};


  var lbp = function(w, h) {
    var arr = [];
    for (var j = 0; j < 3; j++ ) {
      for (var i = 0; i < 3; i++ ) {
        arr.push({x: w*i, y: h*j, w: w, h: h, color: "white"});
      }
    }

    arr[4].color = "black";
    return arr;
  }

  var feat3 = {x: 64, y: 6, rects: lbp(10, 20)};
  var feat4 = {x: 20, y: 70, rects: lbp(10, 8)};
  var feat5 = {x: 8, y: 12, rects: lbp(16, 16)};
  var features1 = [feat3, feat4, feat5];
  var window2 = {x: 240, y: 40, w: 100, h: 100, color: "white", features: features1, text: "b) example LBP features"};

  windows = [window1, window2];


  var window = d3.select(el).selectAll('svg').selectAll('g').data(windows)
                  .enter().append('g')
                  .attr('transform', function(d) { return 'translate('+d.x + ','+d.y+')';});

  window.append('rect')
          .attr('width', function(d) { return d.w;})
          .attr('height', function(d) { return d.h;})
          .attr('fill', function(d) { return d.color;})
          .attr('stroke', 'black')
          .attr('stroke-width', '2px');

  window.append('text')
        .attr('class', 'axis')
        .attr("x", 0)
        .attr("y", 100 + 20)
        .attr("dy", ".35em")
        .text(function(d) {return d.text; });

  window.each(function(d) {
     var feats = d3.select(this).selectAll('.feat').data(d.features);

     feats.enter().append('g')
      .attr('class', 'feat')
      .attr('transform', function(d) { return 'translate('+d.x + ','+ d.y+')'})
      .each(function(d) {
        var rects = d3.select(this).selectAll('rect').data(d.rects);

        rects.enter().append('rect')
          .attr('x', function(d) {return d.x; })
          .attr('y', function(d) {return d.y; })
          .attr('width', function(d) {return d.w; })
          .attr('height', function(d) {return d.h; })
          .attr('fill', function(d) {return d.color})
          .attr('stroke', 'black')
          .attr('stroke-width', '2px');
    });
  });
};

ns.destroy = function(el) {

};

module.exports = ns;
