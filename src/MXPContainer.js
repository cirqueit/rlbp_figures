// var React = require('react');
// var d3 = require('d3');
var d3MXP = require('./d3MXP.js');

var FeatureContainer = React.createClass({
  getDefaultProps: function() {
    return {
      width: 960,
      height: 400
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3MXP.create(el, {
      width: this.props.width,
      height: this.props.height
    }, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3MXP.update(el, this.state);
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

module.exports = FeatureContainer;
