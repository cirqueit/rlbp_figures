// var React = require('react');

var divStyle = {
    maxWidth: "100%",
    height: "auto"
};

var ImageContainer = React.createClass({
    render: function() {
        return (
            <div className="container imageContainer">
                <div className="row">
                    <div className="col-xs-8">
                        <h3>{this.props.title}</h3>
                    </div>
                    <div className="col-xs-8">
                        <img style={divStyle} src={this.props.url}/>
                    </div>
                </div>
            </div>
        );
    }
});

module.exports = ImageContainer;
