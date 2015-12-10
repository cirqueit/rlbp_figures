// var React = require('react');


var CanvasFeatContainer = require('./CanvasFeatContainer.js');
var FeatureContainer = require('./FeatureContainer.js');
var ImageContainer = require('./ImageContainer.js');
var CanvasHeatContainer = require('./CanvasHeatContainer.js');
var HeatContainer = require('./HeatContainer.js');
var LineContainer = require('./LineContainer.js');
var StackedBarContainer = require('./StackedBarContainer.js');
var GroupBarContainer = require('./GroupBarContainer.js');
var HBarContainer = require('./HBarContainer.js');
var BarContainer = require('./BarContainer.js');
var LettersContainer = require('./LettersContainer.js');
var MarkdownContainer = require('./MarkdownContainer.js');
var MXPContainer = require('./MXPContainer.js');

React.render(
    <div>
            {/*
        <div className='container'>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasFeatContainer url='/lenna_raw.json' percent='true' move='true' />
                </div>
            </div>
        </div>
            */}
            {/*
            <div className='row'>
                <div className='col-xs-4'>
                    <MXPContainer/>
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_stage.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={4}  url='/lenna_stage.json' />
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1000} url='/lenna_stage.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={16} xblock={16} url='/lenna_stage.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} legend={true} yblock={1} xblock={32} url='/lenna_stage.json' />
                </div>
            </div>
        </div>
        <FeatureContainer title='Feature'/>
        <div className='container'>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_feat.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={4}  url='/lenna_feat.json' />
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1000} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} yblock={16} xblock={16} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer grey={true} legend={true} yblock={1} xblock={32} url='/lenna_feat.json' />
                </div>
            </div>
        </div>
        <div className='container'>
            <div className='row'>
                <div className='col-xs-3'>
                    <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-3'>
                <CanvasHeatContainer grey={true} yblock={1} xblock={1}  url='/lenna_feat.json' />
                </div>
                <div className='col-xs-3'>
                <CanvasHeatContainer grey={true} yblock={4} xblock={4}  url='/lenna_feat.json' />
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} yblock={1} xblock={1}  url='/lenna_raw.json' />
                </div>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} yblock={1} xblock={1} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} yblock={1} xblock={1000} url='/lenna_feat.json' />
                </div>
                <div className='col-xs-3'>
                    <CanvasHeatContainer width={420} grey={true} legend={true} yblock={1} xblock={64} url='/lenna_feat.json' />
                </div>
            </div>
        </div>

        <div className='container'>
            <div className='row'>
                <div className='col-xs-4'>
                    <h3>
                        LBP Cell Sizes
                    </h3>
                </div>
            </div>
            <div className='row'>
                <div className='col-xs-4'>
                    <CanvasHeatContainer percent={true} grid={true} axis={true} url='/test.json'/>
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer percent={true} grid={true} axis={true} url='/test_r.json'/>
                </div>
                <div className='col-xs-4'>
                    <CanvasHeatContainer percent={true} grid={true} axis={true} url='/test_r2.json' legend={true} />
                </div>
            </div>
        </div>
        <ImageContainer title='Filtering Faces' url='/faces.png' />
        <ImageContainer title='Cascade Results' url='/cascades.jpg' />
        <HeatContainer title='Heat' csv='heatmap.csv' />
        */}
        <GroupBarContainer title='Performance (ms)' csv='/zperformance4.csv' />
        {/*
        <GroupBarContainer title='Performance / Area' csv='/zarea.csv' />
        <StackedBarContainer title='Stacked Bar Chart' csv='population.csv' />
        <LineContainer title='Simple Line Chart' csv='line.csv' />
        <BarContainer title='Simple Bar Chart' csv='letters.csv' />
        <HBarContainer title='Simple HBar Chart' csv='letters.csv' />
        <LettersContainer title='General update pattern' width='100%' height='0'/>
        <MarkdownContainer title='Code' url='data/code.json'/>
        <MarkdownContainer title='Tables' url='data/tables.json'/>
        */}
    </div>,
    document.body
);

// React.render(
//     <div>
//         <div className='container'>
//             <div className='row'>
//                 <div className='col-xs-12'>
//                     <h1>
//                         Cust
//                         <span className="fui-heart"></span>
//                         m Cards by Rei
//                     </h1>
//                 </div>
//             </div>
//         </div>
//         <MarkdownContainer title="Reviews" url='data/cards.json'/>
//         <LineContainer title='Sales' csv='line2.csv' />
//     </div>,
//     document.body
// );
