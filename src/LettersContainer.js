// var React = require('react');
// var d3 = require('d3');
var d3Letters = require('./d3Letters.js');

var LettersContainer = React.createClass({
  getDefaultProps: function() {
    return {
      width: 960,
      height: 500
    };
  },

  getInitialState: function() {
    return {
      data: this._alphabet
    };
  },

  componentDidMount: function() {
    var el = React.findDOMNode(this.refs.d3);
    d3Letters.create(el, {
      width: this.props.width,
      height: this.props.height
    }, this.state);

    this.interval = setInterval(this._shuffle, 5000);
  },

  _alphabet : "abcdefghijklmnopqrstuvwxyz".split(""),

  _shuffle: function() {
    this.setState({data: d3.shuffle(this._alphabet)
                  .slice(0, Math.floor(Math.random() * 25 + 1))
                  .sort()});
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3Letters.update(el, this.state);
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

module.exports = LettersContainer;
