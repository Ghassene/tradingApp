"use client";

import React, { useMemo } from "react";
import * as d3 from "d3";

interface D3SparklineProps {
  data: number[];
  positive?: boolean;
  height?: number;
  width?: number;
  idSuffix: string;
}

export function D3Sparkline({
  data,
  positive = true,
  height = 42,
  width = 128,
  idSuffix,
}: D3SparklineProps) {
  const { linePath, areaPath, lastPoint } = useMemo(() => {
    if (!data || data.length < 2) {
      return { linePath: "", areaPath: "", lastPoint: null };
    }

    const padX = 4;
    const padY = 5;
    const minVal = d3.min(data) ?? 0;
    const maxVal = d3.max(data) ?? 1;
    const span = maxVal - minVal || 0.0001;

    const xScale = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([padX, width - padX]);

    const yScale = d3
      .scaleLinear()
      .domain([minVal - span * 0.08, maxVal + span * 0.08])
      .range([height - padY, padY]);

    const lineGen = d3
      .line<number>()
      .x((_, i) => xScale(i))
      .y((d) => yScale(d))
      .curve(d3.curveMonotoneX);

    const areaGen = d3
      .area<number>()
      .x((_, i) => xScale(i))
      .y0(height - 2)
      .y1((d) => yScale(d))
      .curve(d3.curveMonotoneX);

    const lastIdx = data.length - 1;
    return {
      linePath: lineGen(data) ?? "",
      areaPath: areaGen(data) ?? "",
      lastPoint: {
        x: xScale(lastIdx),
        y: yScale(data[lastIdx]),
      },
    };
  }, [data, width, height]);

  const strokeColor = positive ? "#059669" : "#E11D48";
  const gradId = `spark-grad-${idSuffix}`;

  if (!linePath) {
    return <div style={{ width, height }} className="bg-slate-100 rounded" />;
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.26} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path
        d={linePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.85}
        strokeLinecap="round"
      />
      {lastPoint && (
        <>
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4.2}
            fill={strokeColor}
            fillOpacity={0.22}
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={2.3}
            fill={strokeColor}
          />
        </>
      )}
    </svg>
  );
}
