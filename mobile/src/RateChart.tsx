import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { fmt, fmtDate, PAIR_INFO, type DayRates, type Pair } from "./rates";

const H = 220;
const PAD = { t: 12, r: 8, b: 24, l: 56 };

export function RateChart({ data, pair }: { data: DayRates[]; pair: Pair }) {
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const color = PAIR_INFO[pair].color;

  const values = data.map((d) => d[pair]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max * 0.01;
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;
  const W = width || 1;

  const x = (i: number) => PAD.l + (i / Math.max(data.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(values.length - 1)},${H - PAD.b}L${x(0)},${H - PAD.b}Z`;
  const ticks = [0, 0.5, 1].map((t) => lo + t * (hi - lo));

  const pick = (px: number) => {
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (data.length - 1));
    setHover(Math.min(Math.max(i, 0), data.length - 1));
  };
  const h = hover !== null ? data[hover] : null;

  return (
    <View>
      <View style={styles.readout}>
        <Text style={styles.readoutDate}>{h ? fmtDate(h.date, true) : "Touchez le graphique"}</Text>
        <Text style={[styles.readoutValue, { color }]}>{h ? fmt(h[pair]) : " "}</Text>
      </View>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
        onResponderRelease={() => setHover(null)}
        onResponderTerminationRequest={() => false}
      >
        {width > 0 && (
          <Svg width={W} height={H}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.3} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            {ticks.map((t) => (
              <Line key={`l${t}`} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#22304a" strokeDasharray="3 4" />
            ))}
            {ticks.map((t) => (
              <SvgText key={`t${t}`} x={PAD.l - 6} y={y(t) + 4} fill="#64748b" fontSize={10} textAnchor="end">
                {fmt(t)}
              </SvgText>
            ))}
            <SvgText x={x(0)} y={H - 6} fill="#64748b" fontSize={10} textAnchor="start">
              {data[0] && fmtDate(data[0].date)}
            </SvgText>
            <SvgText x={x(data.length - 1)} y={H - 6} fill="#64748b" fontSize={10} textAnchor="end">
              {data[data.length - 1] && fmtDate(data[data.length - 1].date)}
            </SvgText>
            <Path d={area} fill="url(#fill)" />
            <Path d={line} fill="none" stroke={color} strokeWidth={2.25} strokeLinejoin="round" />
            {h && hover !== null && (
              <>
                <Line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="#475569" />
                <Circle cx={x(hover)} cy={y(h[pair])} r={5} fill={color} stroke="#0c1222" strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 },
  readoutDate: { color: "#94a3b8", fontSize: 12 },
  readoutValue: { fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "600" },
});
