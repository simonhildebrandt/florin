import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useDebouncedCallback } from 'use-debounce';


export default function({onDateChange, transactions, startDate, endDate}) {

  const data = transactions.filter(t => {
    const date = new Date(t.executionDateTime)
    return date > startDate && date < endDate
  })

  const [transform, setTransform] = useState(d3.zoomIdentity);

  const marginTop = 20;
  const marginRight = 20;
  const marginBottom = 30;
  const marginLeft = 40;
  const width = 1000 - marginLeft - marginRight;
  const height = 400 - marginTop - marginBottom;

  const gx = useRef();
  const gy = useRef();

  const x = transform.rescaleX(
    d3.scaleUtc()
      .domain([startDate, endDate])
      .range([marginLeft, width - marginRight])
  );

  const balances = data.map(t => t.balance);
  const y = transform.rescaleY(
    d3.scaleLinear()
      .domain([Math.max(...balances), Math.min(...balances)])
      .range([marginTop, height - marginBottom])
  )

  const line = d3.line()
    .x(d => x(new Date(d.executionDateTime)))
    .y(d => y(d.balance));

  // const data = [
  //   {
  //     executionDateTime: '2025-02-03',
  //     balance: 0
  //   },
  //   {
  //     executionDateTime: '2025-03-30',
  //     balance: 1000
  //   }
  // ]

  const ref = useRef();
  const reload = useDebouncedCallback(_ => {
    onDateChange(...x.domain().map(d => Number(d)))
  }, 200);

  const toggleElement = (show, id) => () => {
    document.getElementById(id).setAttribute("visibility", show ? "visible" : "hidden")
  }

  useEffect(() => { d3.select(gx.current).call(d3.axisBottom(x)) }, [gx, x]);
  useEffect(() => { d3.select(gy.current).call(d3.axisLeft(y)) }, [gy, y]);

  useEffect(_ => {
    const zoom = d3.zoom().on('zoom', function handleZoom(e) {
      setTransform(e.transform);
      reload();
    });

    function constrain(transform, extent, translateExtent) {
      var dx0 = transform.invertX(extent[0][0]) - translateExtent[0][0],
          dx1 = transform.invertX(extent[1][0]) - translateExtent[1][0],
          dy0 = transform.invertY(extent[0][1]) - translateExtent[0][1],
          dy1 = transform.invertY(extent[1][1]) - translateExtent[1][1];
      return transform.translate(
        dx1 > dx0 ? (dx0 + dx1) / 2 : Math.min(0, dx0) || Math.max(0, dx1),
        dy1 > dy0 ? (dy0 + dy1) / 2 : Math.min(0, dy0) || Math.max(0, dy1)
      );
    }

    const svg = d3.select(ref.current)
    svg.call(zoom.constrain(constrain));
  }, [transactions, transform]);

  return <svg ref={ref} width={width} height={height}>
    <g ref={gx} transform={`translate(0,${height - marginBottom})`} />
    <g ref={gy} transform={`translate(${marginLeft},0)`} />
    <g transform={transform}>
      <path
        fill="none"
        stroke="blue"
        strokeWidth={1.5}
        d={line(data)}
      />
      <g>
        { data.map(d => (
          <g key={d.transactionId}>
            <circle
              r={5}
              fill={Number(d.amount) > 0 ? 'green' : 'red'}
              cx={x(new Date(d.executionDateTime))}
              cy={y(d.balance)}
              onMouseEnter={toggleElement(true, d.transactionId)}
              onMouseLeave={toggleElement(false, d.transactionId)}
            />
            <text
              id={d.transactionId}
              x={x(new Date(d.executionDateTime))}
              y={y(d.balance)}
              visibility={"hidden"}
            >
              {`${new Date(d.executionDateTime).toLocaleString()}\n${d.balance}`}
            </text>
          </g>
        ))}
      </g>
    </g>
  </svg>
}
