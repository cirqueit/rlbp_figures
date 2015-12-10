// var React = require('react');
// var d3 = require('d3');
var d3CanvasFeat = require('./d3CanvasFeat.js');

var CanvasFeatContainer = React.createClass({
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
        return {data: [],
                location: {x: 120, y: 100, w: 80, h: 80},
        };
    },
  getDefaultProps: function() {
    return {
      move: true,
      title: "",
      width: 960,
      height: 600,
      scale: 1.0,
      pixelated: true,
      yblock: 1,
      xblock: 1,
      grid: false,
      search: {x: 320, y: 160, w: 240, h: 240},
      feature: {x: 600, y: 0, w: 500, h: 500},
    };
  },

  componentDidMount: function() {
    this.loadJSONFromServer();
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasFeat.create(el, this.props, this.state);

    if(this.props.move == true) {
      // this.interval = setInterval(this._step, 100);
    }
  },

  _step: function() {
    var next_location = this.state.location;

    next_location.x += 1;
    if(next_location.x + next_location.w > 299){
      next_location.x = 0;
      next_location.y += 1;
    }
    if(next_location.y + next_location.h > 219){
      next_location.y = 0;
    }
  
    this.setState({location: next_location});
  },

  componentDidUpdate: function(prevProps, prevState) {
    var el = React.findDOMNode(this.refs.d3);
    d3CanvasFeat.update(el, this.props, this.state);

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

module.exports = CanvasFeatContainer;
