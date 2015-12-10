// var React = require('react');
// var marked = require('marked');
require('marked');
require('./d3Table.less');

var MarkdownFigure = React.createClass({
    render: function() {
        marked.setOptions({
            highlight: function (code) {
                // return require('highlight.js').highlightAuto(code).value;
                return hljs.highlightAuto(code).value;
            }
        });
        var rawMarkup = marked(this.props.children.toString(), {sanitize: true, breaks: true});
        return (
            <div className='row'>
                <div className='col-xs-12'>
                    <div className='markdown'>
                        <h7 className='markdownTitle'>
                            {this.props.title}
                        </h7>
                        <span dangerouslySetInnerHTML={{__html: rawMarkup}} />
                    </div>
                </div>
            </div>
        );
    }
});

module.exports = MarkdownFigure;
