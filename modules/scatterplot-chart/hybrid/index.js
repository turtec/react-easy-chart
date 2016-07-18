import React from 'react';
import {
  scaleLinear as linear,
  scalePoint as point
} from 'd3-scale';
import {
  event as lastEvent,
  min,
  max,
  scale,
  select,
  svg,
  time
} from 'd3';
import { timeParse as parse } from 'd3-time-format';
import { extent } from 'd3-array';
import { createElement } from 'react-faux-dom';
import { Style } from 'radium';
import merge from 'lodash.merge';
import {
  getRandomId,
  calcDefaultDomain,
  defaultStyles,
  getAxisStyles,
  createCircularTicks
} from '../../shared';

const dateParser = {};

const color = scale.category20();

const axisMargin = 18;

export default class ScatterplotChart extends React.Component {
  static get propTypes() {
    return {
      axes: React.PropTypes.bool,
      axisLabels: React.PropTypes.shape({
        x: React.PropTypes.string,
        y: React.PropTypes.string
      }),
      clickHandler: React.PropTypes.func,
      config: React.PropTypes.array,
      data: React.PropTypes.array.isRequired,
      datePattern: React.PropTypes.string,
      yAxisOrientRight: React.PropTypes.bool,
      dotRadius: React.PropTypes.number,
      verticalGrid: React.PropTypes.bool,
      grid: React.PropTypes.bool,
      height: React.PropTypes.number,
      useLegend: React.PropTypes.bool,
      margin: React.PropTypes.object,
      mouseOverHandler: React.PropTypes.func,
      mouseOutHandler: React.PropTypes.func,
      mouseMoveHandler: React.PropTypes.func,
      style: React.PropTypes.object,
      tickTimeDisplayFormat: React.PropTypes.string,
      width: React.PropTypes.number,
      xDomainRange: React.PropTypes.array,
      yDomainRange: React.PropTypes.array,
      xTickNumber: React.PropTypes.number,
      yTickNumber: React.PropTypes.number,
      xTicks: React.PropTypes.number,
      yTicks: React.PropTypes.number,
      xType: React.PropTypes.string,
      yType: React.PropTypes.string
    };
  }

  static get defaultProps() {
    return {
      axes: false,
      axisLabels: {
        x: '',
        y: ''
      },
      clickHandler: () => {},
      config: [],
      datePattern: '%d-%b-%y',
      dotRadius: 5,
      grid: false,
      mouseOverHandler: () => {},
      mouseOutHandler: () => {},
      mouseMoveHandler: () => {},
      width: 320,
      height: 180,
      xType: 'linear',
      yType: 'linear'
    };
  }

  constructor(props) {
    super(props);
    this.uid = getRandomId();
  }

  componentDidMount() {
    this.initialise();
    const ref = this.refs.scatterplotChart;
    createCircularTicks(ref);
  }

  componentDidUpdate() {
    this.transition();
    const ref = this.refs.scatterplotChart;
    createCircularTicks(ref);
  }

  getScale(type) {
    switch (type) {
      case 'time':
        return time.scale();
      case 'text':
        return point();
      default:
        return linear();
    }
  }

  setDomainAndRange(axesType, domainRange, data, type, length, yAxisOrientRight) {
    const dataIndex =
      (axesType === 'x')
        ? 'x'
        : 'y';

    let axis;
    let minAmount;
    let maxAmount;

    const parseDate = (v) => this.parseDate(v);

    switch (type) {
      case 'text':
        axis = point();
        axis
          .domain(data.map((d) => d[dataIndex]), 1)
          .range([0, length])
          .padding(1);
        break;
      case 'linear':
        axis = linear();
        minAmount = min(data, (d) => d[dataIndex]);
        maxAmount = max(data, (d) => d[dataIndex]);
        if (domainRange) {
          axis
            .domain(calcDefaultDomain(domainRange, type, parseDate));
        } else {
          // set initial domain
          axis
            .domain([minAmount, maxAmount]);
          // calculate 1 tick offset
          const ticks = axis.ticks();

          minAmount =
            (yAxisOrientRight && axesType === 'x')
              ? minAmount
              : minAmount - (ticks[1] - ticks[0]);

          maxAmount =
            (yAxisOrientRight && axesType === 'x')
              ? maxAmount + (ticks[1] - ticks[0])
              : maxAmount;

          axis
            .domain([minAmount, maxAmount]);
        }
        axis
          .range(
            (axesType === 'x')
              ? [0, length]
              : [length, 0]);
        break;
      case 'time':
        axis = time.scale();
        axis
          .domain(
            (domainRange)
              ? calcDefaultDomain(domainRange)
              : extent(data, (d) => parseDate(d[dataIndex])))
          .range(
            (axesType === 'x')
              ? [0, length]
              : [length, 0]);
        break;
      default:
        break;
    }
    return axis;
  }

  getDataConfig(type) {
    const {
      config
    } = this.props;

    const index = config.findIndex((item) => item.type === type);
    return config[index];
  }

  getFill(data) {
    const configItem = this.getDataConfig(data.type);
    return typeof configItem !== 'undefined' ? configItem.color : color(data.type);
  }

  getRadius(data, dataItem, dotRadius) {
    if (typeof data[0].z !== 'undefined') {
      const range = extent(data, (d) => d.z);
      const mn = range[0];
      const mx = range[1];
      const p = ((dataItem.z - mn) / (mx - mn));
      const minRad = 5;
      const maxRad = 20;
      const rad = minRad + ((maxRad - minRad) * p);
      return rad;
    }
    return dotRadius;
  }

  getStroke(data) {
    const configItem = this.getDataConfig(data.type);
    return typeof configItem !== 'undefined' ? configItem.stroke : 'none';
  }

  getCircles() {
    const uid = this.uid;
    return select(`#scatterplot-chart-${uid}`)
      .selectAll('circle'); // '.dot'
  }

  getXAxis() {
    const uid = this.uid;
    return select(`#scatterplot-x-axis-${uid}`);
  }

  getYAxis() {
    const uid = this.uid;
    return select(`#scatterplot-y-axis-${uid}`);
  }

  calcMargin(axes, spacer, yAxisOrientRight) {
    let defaultMargins =
      (axes)
        ? { top: 24, right: 24, bottom: 24, left: 48 }
        : { top: spacer, right: spacer, bottom: spacer, left: spacer };
    if (yAxisOrientRight) {
      defaultMargins =
        (axes)
          ? { top: 24, right: 48, bottom: 24, left: 24 }
          : { top: spacer, right: spacer, bottom: spacer, left: spacer };
    }
    return defaultMargins;
  }

  calculateInnerW(w, m) {
    return (w - (m.left + m.right));
  }

  calculateInnerH(h, m) {
    const {
      dotRadius
    } = this.props;

    return (h - (m.top + m.bottom + (dotRadius * 2)));
  }

  calculateXAxis({ h, x }) {
    const {
      xType,
      tickTimeDisplayFormat,
      xTickNumber,
      grid,
      verticalGrid,
      xTicks
    } = this.props;

    const axis = svg.axis()
      .scale(x)
      .orient('bottom');

    if (xType === 'time' && tickTimeDisplayFormat) {
      axis
        .tickFormat(time.format(tickTimeDisplayFormat));
    }

    if (xTickNumber) {
      axis
        .ticks(xTickNumber);
    }

    if (grid && verticalGrid) {
      axis
        .tickSize(-h, 6)
        .tickPadding(15);
    } else {
      axis
        .tickSize(0)
        .tickPadding(15);
    }

    if (xTicks) {
      axis
        .ticks(xTicks);
    }

    return axis;
  }

  calculateYAxis({ y, innerW }) {
    const {
      grid,
      yTicks,
      yAxisOrientRight
    } = this.props;

    const axis = svg.axis()
      .scale(y)
      .orient(yAxisOrientRight ? 'right' : 'left');

    if (grid) {
      axis
        .tickSize(-innerW, 6)
        .tickPadding(12);
    } else {
      axis
        .tickPadding(10);
    }

    if (yTicks) {
      axis
        .ticks(yTicks);
    }

    return axis;
  }

  initialise() {
    const {
      axes
    } = this.props;

    const p = this.calculateChartParameters();

    if (axes) {
      this.initialiseXAxis(p);

      this.initialiseYAxis(p);
    }

    this.initialiseChart(p);
  }

  initialiseXAxis({ xAxis }) {
    this.getXAxis()
      .call(xAxis);
  }

  initialiseYAxis({ yAxis }) {
    this.getYAxis()
      .call(yAxis);
  }

  initialiseChart({ x, y }) {
    const {
      data,
      dotRadius,
      xType,
      mouseOverHandler,
      mouseOutHandler,
      mouseMoveHandler,
      clickHandler
    } = this.props;

    const calculateDate = (v) => this.parseDate(v);

    const calculateR = (d) => this.getRadius(data, d, dotRadius);
    const calculateCX = (d) => (
        (xType === 'time')
          ? x(calculateDate(d.x))
          : x(d.x));
    const calculateCY = (d) => y(d.y);

    const getFill = (d) => this.getFill(d);
    const getStroke = (d) => this.getStroke(d);

    const mouseOver = (d) => mouseOverHandler(d, lastEvent);
    const mouseOut = (d) => mouseOutHandler(d, lastEvent);
    const mouseMove = (d) => mouseMoveHandler(d, lastEvent);
    const click = (d) => clickHandler(d, lastEvent);

    const circle = this.getCircles()
      .data(data);

    circle
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('r', calculateR)
      .attr('cx', calculateCX)
      .attr('cy', calculateCY)
      .style('fill', getFill)
      .style('stroke', getStroke)
      .on('mouseover', mouseOver)
      .on('mouseout', mouseOut)
      .on('mousemove', mouseMove)
      .on('click', click);
  }

  transition() {
    const {
      axes
    } = this.props;

    const p = this.calculateChartParameters();

    if (axes) {
      this.transitionXAxis(p);

      this.transitionYAxis(p);
    }

    this.transitionChart(p);
  }

  transitionXAxis({ xAxis }) {
    this.getXAxis()
      .transition()
      .duration(750)
      .call(xAxis);
  }

  transitionYAxis({ yAxis }) {
    this.getYAxis()
      .transition()
      .duration(750)
      .call(yAxis);
  }

  transitionChart({ x, y }) {
    const {
      data,
      dotRadius,
      xType,
      mouseOverHandler,
      mouseOutHandler,
      mouseMoveHandler,
      clickHandler
    } = this.props;

    const calculateDate = (v) => this.parseDate(v);

    const calculateR = (d) => this.getRadius(data, d, dotRadius);
    const calculateCX = (d) => (
        (xType === 'time')
          ? x(calculateDate(d.x))
          : x(d.x));
    const calculateCY = (d) => y(d.y);

    const mouseOver = (d) => mouseOverHandler(d, lastEvent);
    const mouseOut = (d) => mouseOutHandler(d, lastEvent);
    const mouseMove = (d) => mouseMoveHandler(d, lastEvent);
    const click = (d) => clickHandler(d, lastEvent);

    const getFill = (d) => this.getFill(d);
    const getStroke = (d) => this.getStroke(d);

    const n = data.length;
    const circle = this.getCircles()
      .data(data);

    if (n) {
      circle
        .transition()
        .duration(750)
        .attr('r', calculateR)
        .attr('cx', calculateCX)
        .attr('cy', calculateCY);

      circle
        .style('fill', getFill)
        .style('stroke', getStroke)
        .on('mouseover', mouseOver)
        .on('mouseout', mouseOut)
        .on('mousemove', mouseMove)
        .on('click', click);

      circle
        .enter()
        .append('circle')
        .attr('class', 'dot')
        .attr('r', calculateR)
        .attr('cx', calculateCX)
        .attr('cy', calculateCY)
        .style('fill', getFill)
        .style('stroke', getStroke)
        .on('mouseover', mouseOver)
        .on('mouseout', mouseOut)
        .on('mousemove', mouseMove)
        .on('click', click);
    }

    circle
      .exit()
      .remove();
  }

  createSvgNode({ m, w, h }) {
    const node = createElement('svg');
    select(node)
      .attr('width', w + m.left + m.right)
      .attr('height', h + m.top + m.bottom);
    return node;
  }

  createSvgRoot({ node, m }) {
    return select(node)
      .append('g')
      .attr('transform', `translate(${m.left}, ${m.top})`);
  }

  createXAxis({ m, innerW, innerH, root }) {
    const {
      yAxisOrientRight,
      axisLabels
    } = this.props;

    const uid = this.uid;

    const group = root
      .append('g')
      .attr('class', 'x axis')
      .attr('id', `scatterplot-x-axis-${uid}`)
      .attr('transform', `translate(0, ${innerH})`);

    const label = axisLabels.x;

    if (label) {
      group
        .append('text')
        .attr('class', 'label')
        .attr('x',
            (yAxisOrientRight)
              ? 0
              : innerW)
        .attr('y', m.bottom + axisMargin)
        .style('text-anchor',
            (yAxisOrientRight)
              ? 'start'
              : 'end')
        .text(label);
    }
  }

  createYAxis({ m, innerW, root }) {
    const {
      yAxisOrientRight,
      axisLabels
    } = this.props;

    const uid = this.uid;

    const group = root
      .append('g')
      .attr('class', 'y axis')
      .attr('id', `scatterplot-y-axis-${uid}`)
      .attr('transform',
        (yAxisOrientRight)
          ? `translate(${innerW}, 0)`
          : 'translate(0, 0)');

    const label = axisLabels.y;

    if (label) {
      group
        .append('text')
        .attr('class', 'label')
        .attr('transform', 'rotate(-90)')
        .attr('y',
          (yAxisOrientRight)
            ? -25 + m.right
            : 10 - m.left
        )
        .attr('dy', '.71em')
        .style('text-anchor', 'end')
        .text(label);
    }
  }

  createScatterplotChart({ root }) {
    const uid = this.uid;

    root
      .append('g')
      .attr('id', `scatterplot-chart-${uid}`);
  }

  createStyle() {
    const {
      style,
      grid,
      verticalGrid,
      yAxisOrientRight
    } = this.props;

    const uid = this.uid;
    const scope = `.scatterplot-chart-${uid}`;
    const axisStyles = getAxisStyles(grid, verticalGrid, yAxisOrientRight);
    const rules = merge({}, defaultStyles, style, axisStyles);

    return (
      <Style
        scopeSelector={scope}
        rules={rules}
      />
    );
  }

  parseDate(v) {
    const {
      datePattern
    } = this.props;

    const datePatternParser = (
      dateParser[datePattern] || (
      dateParser[datePattern] = parse(datePattern)));

    return datePatternParser(v);
  }

  calculateChartParameters() {
    const {
      axes,
      data,
      margin,
      width,
      height,
      dotRadius,
      xType,
      yType,
      xDomainRange,
      yDomainRange,
      yAxisOrientRight
    } = this.props;

    /*
     * We could "bind" but this is neater
     */
    const parseDate = (v) => this.parseDate(v);

    const m = margin || this.calcMargin(axes, dotRadius * 2, yAxisOrientRight);
    const w = width;
    const h = height + (dotRadius * 3);

    const innerW = this.calculateInnerW(width, m);
    const innerH = this.calculateInnerH(height, m);

    const defaultXDomain =
      (xDomainRange)
        ? calcDefaultDomain(xDomainRange, xType, parseDate)
        : null;

    const defaultYDomain =
      (yDomainRange)
        ? calcDefaultDomain(yDomainRange, yType, parseDate)
        : null;

    const x = this.setDomainAndRange('x', defaultXDomain, data, xType, innerW, yAxisOrientRight);
    const y = this.setDomainAndRange('y', defaultYDomain, data, yType, innerH, yAxisOrientRight);

    const xAxis = this.calculateXAxis({ m, h, x, innerW });
    const yAxis = this.calculateYAxis({ m, y, innerW });

    const node = this.createSvgNode({ m, w, h });
    const root = this.createSvgRoot({ node, m });

    return {
      m,
      w,
      h,
      innerW,
      innerH,
      x,
      y,
      xAxis,
      yAxis,
      node,
      root
    };
  }

  render() {
    const {
      axes
    } = this.props;

    const p = this.calculateChartParameters();

    if (axes) {
      this.createXAxis(p);

      this.createYAxis(p);
    }

    this.createScatterplotChart(p);

    const uid = this.uid;
    const className = `scatterplot-chart-${uid}`;
    const {
      node
    } = p;

    return (
      <div ref="scatterplotChart" className={className}>
        {this.createStyle()}
        {node.toReact()}
      </div>
    );
  }
}
