// var React = require('react');
// var d3 = require('d3');
var d3CanvasHeat = require('./d3CanvasHeat.js');

var CanvasHeatContainer = React.createClass({
    loadJSONFromServer: function () {
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            cache: false,
            success: function(data) {
                this.setState({data: data});
            }.bind(this),
            error: function(xhr, status, err) {
                console.error(this.props.url, status, err.toString());
            }.bind(this)
        });
    },

    getInitialState: function () {
        return {data: []};
    },
  getDefaultProps: function() {
    return {
      width: 480,
      height: 360,
      scale: 2.14,
      pixelated: true,
      yblock: 1,
      xblock: 1,
      grid: false,
    };
  },

  componentDidMount: function() {
    this.loadJSONFromServer();
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasHeat.create(el, this.props, this.state);
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasHeat.update(el, this.props, this.state);
  },

  // render: function() {
  //   return (
  //     <div className="container">
  //       <div className="row">
  //         <div className="col-xs-8">
  //           <h3>{this.props.title}</h3>
  //           <hr />
  //           <div ref="d3"></div>
  //         </div>
  //       </div>
  //     </div>
  //   );
  // },
  render: function() {
    return (
      <div>
          <h3>{this.props.title}</h3>
          <hr />
          <div ref="d3"></div>
      </div>
    );
  },
});

module.exports = CanvasHeatContainer;
