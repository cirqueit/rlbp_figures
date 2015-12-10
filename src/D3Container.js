var D3Container = React.createClass({
  getDefaultProps: function() {
    return {
      width: 960,
      height: 300,
    };
  },

  componentDidMount: function() {
    this.d3Create();
  },

  componentDidUpdate: function(prevProps, prevState) {
    this.d3Update();
  },
  
  d3Create: function() {
    var el = React.findDOMNode(this.refs.d3);
  }
  d3Update: function() {
    var el = React.findDOMNode(this.refs.d3);
  }

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

module.exports = GroupBarContainer;
