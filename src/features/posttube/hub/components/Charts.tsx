import { axisTicks, barRects, formatDay, retentionPath, sparklineArea, sparklinePath } from "../hubModel";
import type { HubDayPoint } from "../hubApi";

/*
  Tiny SVG charts, no library. The path builders live in hubModel.ts and
  are tested there; these components only place them. Colour comes from
  hub.css through the class names (tokens), never from an attribute.
*/

export function Sparkline({ values, width = 64, height = 18, className = "" }: { values: number[]; width?: number; height?: number; className?: string }) {
  const empty = values.length === 0 || values.every((v) => v <= 0);
  const box = { width, height, pad: 1.5 };
  return (
    <svg className={`hub-spark ${empty ? "is-empty" : ""} ${className}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true" focusable="false">
      {!empty ? <path className="area" d={sparklineArea(values, box)} /> : null}
      <path d={empty ? sparklinePath(values.length ? values : [0, 0], box, 1) : sparklinePath(values, box)} />
    </svg>
  );
}

/** The 48 h realtime counter: one bar per hour, the latest hour in the text colour. */
export function LiveBars({ values }: { values: number[] }) {
  const width = 288;
  const height = 48;
  const rects = barRects(values, { width, height, pad: 0 }, 1.5);
  return (
    <svg className="hub-live-bars hub-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Views per hour, last 48 hours">
      {rects.map(([x, y, w, h], i) => (
        <rect key={i} className={`bar ${i === rects.length - 1 ? "is-last" : ""}`} x={x} y={y} width={w} height={h} rx={1} />
      ))}
    </svg>
  );
}

/** Views by day: an area line with three grid lines and up to four date ticks. */
export function DayChart({ points, ariaLabel = "Views by day" }: { points: HubDayPoint[]; ariaLabel?: string }) {
  const width = 640;
  const height = 140;
  const values = points.map((p) => p.views);
  const max = Math.max(...values, 1);
  const box = { width, height, pad: 6 };
  const ticks = axisTicks(points.length, 4);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 8 }}>
        <div className="hub-chart-y" aria-hidden="true">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        <svg className="hub-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
          <line className="grid" x1={0} x2={width} y1={box.pad} y2={box.pad} />
          <line className="grid" x1={0} x2={width} y1={height / 2} y2={height / 2} />
          <line className="grid" x1={0} x2={width} y1={height - box.pad} y2={height - box.pad} />
          <path className="area" d={sparklineArea(values, box, max)} />
          <path className="line" d={sparklinePath(values, box, max)} />
        </svg>
      </div>
      <div className="hub-chart-axis" style={{ paddingLeft: 28 }} aria-hidden="true">
        {ticks.map((i) => (
          <span key={i}>{formatDay(points[i]?.day ?? "")}</span>
        ))}
      </div>
    </div>
  );
}

/** Hourly fallback for the overview when the creator feed has no daily series. */
export function HourChart({ values, ariaLabel = "Views per hour, last 48 hours" }: { values: number[]; ariaLabel?: string }) {
  const width = 640;
  const height = 140;
  const max = Math.max(...values, 1);
  const box = { width, height, pad: 6 };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 8 }}>
        <div className="hub-chart-y" aria-hidden="true">
          <span>{max}</span>
          <span>{Math.round(max / 2)}</span>
          <span>0</span>
        </div>
        <svg className="hub-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={ariaLabel}>
          <line className="grid" x1={0} x2={width} y1={height / 2} y2={height / 2} />
          <line className="grid" x1={0} x2={width} y1={height - box.pad} y2={height - box.pad} />
          <path className="area" d={sparklineArea(values, box, max)} />
          <path className="line" d={sparklinePath(values, box, max)} />
        </svg>
      </div>
      <div className="hub-chart-axis" style={{ paddingLeft: 28 }} aria-hidden="true">
        <span>48h ago</span>
        <span>24h ago</span>
        <span>now</span>
      </div>
    </div>
  );
}

/** Retention: percent of viewers still watching at each percent of the video. */
export function RetentionCurve({ points }: { points: number[] }) {
  const width = 640;
  const height = 140;
  const box = { width, height, pad: 6 };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", gap: 8 }}>
        <div className="hub-chart-y" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <svg className="hub-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Audience retention across the video">
          <line className="grid" x1={0} x2={width} y1={box.pad} y2={box.pad} />
          <line className="grid" x1={0} x2={width} y1={height / 2} y2={height / 2} />
          <line className="grid" x1={0} x2={width} y1={height - box.pad} y2={height - box.pad} />
          <path className="area" d={`${retentionPath(points, box)} L${width} ${height - box.pad} L0 ${height - box.pad} Z`} />
          <path className="line" d={retentionPath(points, box)} />
        </svg>
      </div>
      <div className="hub-chart-axis" style={{ paddingLeft: 28 }} aria-hidden="true">
        <span>Start</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>End</span>
      </div>
    </div>
  );
}
