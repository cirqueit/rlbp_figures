// var React = require('react');
// var d3 = require('d3');
var d3Line = require('./d3Line.js');

var LineContainer = React.createClass({
  getDefaultProps: function() {
    return {
      width: 800,
      height: 500,
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Line.create(el, {
      width: this.props.width,
      height: this.props.height,
      csv: this.props.csv
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Line.update(el, this.props);
  },

  render: function() {
    return (
      <div className="container">
        <div className="row">
          <div className="col-xs-8">
            <h3>{this.props.title}</h3>
            <hr />
            <div ref="d3"></div>
          </div>
        </div>
      </div>
    );
  },
});

module.exports = LineContainer;
