// var React = require('react');
var MarkdownFigure = require('./MarkdownFigure.js');

var MarkdownList = React.createClass({
    render: function() {
        var markdownNodes = this.props.data.map(function (markdown) {
            return (
                <MarkdownFigure title={markdown.title}>
                    {markdown.text}
                </MarkdownFigure>
            );
        });
        return (
            <div className='markdownList'>
                {markdownNodes}
            </div>
        );
    }
});

module.exports = MarkdownList;
