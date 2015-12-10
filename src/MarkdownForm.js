// var React = require('react');

var MarkdownForm = React.createClass({
    handleSubmit: function(e) {
        e.preventDefault();
        var title = React.findDOMNode(this.refs.title).value.trim();
        var text = React.findDOMNode(this.refs.text).value.trim();
        if (!text || !title) {
            return;
        }
        this.props.onMarkdownSubmit({title: title, text: text});
        React.findDOMNode(this.refs.title).value = '';
        React.findDOMNode(this.refs.text).value = '';
        return;
    },
    render: function() {
        var divStyle = {width: '100%'};
        return (
            <div>
                <h7>
                    Add {this.props.title.toLowerCase()}
                </h7>
                <form className='markdownForm' onSubmit={this.handleSubmit}>
                    <div className="row">
                        <div className="col-xs-12">
                            <input style={divStyle} type="text" ref="title" placeholder="   Title" />
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-xs-12">
                            <textarea style={divStyle} type="text" ref="text" placeholder="Markdown text..." />
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-xs-12">
                            <button className='btn btn-primary' type='submit'>Post</button>
                        </div>
                    </div>
                </form>
            </div>
        );
    }
});

module.exports = MarkdownForm;
