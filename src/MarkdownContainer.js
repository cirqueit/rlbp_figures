// var React = require('react');
var MarkdownForm = require('./MarkdownForm.js');
var MarkdownList = require('./MarkdownList.js');

var MarkdownContainer = React.createClass({
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
    handleMarkdownSubmit: function(markdown) {
        var markdowns = this.state.data;
        var newMarkdowns = markdowns.concat([markdown]);
        this.setState({data: newMarkdowns});
        $.ajax({
            url: this.props.url,
            dataType: 'json',
            type: 'POST',
            data: markdown,
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
    getDefaultProps: function () {
        return {pollInterval: null};
    },
    componentDidMount: function() {
        this.loadJSONFromServer();
        if (this.props.pollInterval) {
            setInterval(this.loadJSONFromServer, this.props.pollInterval);
        }
    },
    render: function() {
        return (
            <div className="container">
                <div className='markdownBox'>
                    <h3>{this.props.title}</h3>
                    <hr />
                    <div className="row">
                        <div className="col-xs-8">
                            <MarkdownList data={this.state.data}/>
                        </div>
                        <div className="col-xs-4">
                            <MarkdownForm title={this.props.title} onMarkdownSubmit={this.handleMarkdownSubmit} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
});

module.exports = MarkdownContainer;
