import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors, createStyles } from '../theme';

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

/**
 * Smooth line chart with a dashed grid. Tap (or click) anywhere to move the marker; the first series
 * carries the marker and the tooltip.
 */
export function LineChart({
  labels,
  series,
  height = 250,
  unit = '',
}: {
  labels: string[];
  series: ChartSeries[];
  height?: number;
  /** Shown after the value in the tooltip, e.g. "meetings". */
  unit?: string;
}) {
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const padLeft = 36;
  const padRight = 12;
  const padTop = 18;
  const padBottom = 28;
  const count = labels.length;
  const selected = Math.min(picked ?? count - 1, count - 1);

  const highest = Math.max(0, ...series.flatMap((s) => s.values));
  const top = Math.max(5, Math.ceil(highest / 5) * 5); // five grid steps of whole numbers
  const innerWidth = Math.max(1, width - padLeft - padRight);
  const innerHeight = height - padTop - padBottom;
  const x = (index: number) => padLeft + (count === 1 ? innerWidth / 2 : (innerWidth * index) / (count - 1));
  const y = (value: number) => padTop + innerHeight * (1 - value / top);

  // Horizontal tangents at every point give the soft S-curves, and never overshoot the data.
  const pathOf = (values: number[]) =>
    values
      .map((value, index) => {
        if (index === 0) return `M ${x(0)} ${y(value)}`;
        const middle = (x(index - 1) + x(index)) / 2;
        return `C ${middle} ${y(values[index - 1])} ${middle} ${y(value)} ${x(index)} ${y(value)}`;
      })
      .join(' ');

  const ticks = [0, 1, 2, 3, 4, 5].map((step) => (top / 5) * step);
  const stride = innerWidth / count < 30 ? 2 : 1; // thin the month labels on narrow screens
  const lead = series[0];
  const leadValue = lead?.values[selected] ?? 0;
  const tooltipLeft = Math.max(0, Math.min(width - 112, x(selected) - 56));

  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {width > 0 ? (
        <>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(event) => {
              const ratio = (event.nativeEvent.locationX - padLeft) / innerWidth;
              setPicked(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))));
            }}
          >
            <Svg width={width} height={height}>
              {ticks.map((tick) => (
                <Line
                  key={tick}
                  x1={padLeft}
                  x2={width - padRight}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 6"
                />
              ))}
              {series.map((s) => (
                <Path key={s.name} d={pathOf(s.values)} stroke={s.color} strokeWidth={3} fill="none" strokeLinecap="round" />
              ))}
              {lead ? (
                <Circle cx={x(selected)} cy={y(leadValue)} r={6} fill="#ffffff" stroke={lead.color} strokeWidth={3} />
              ) : null}
            </Svg>
          </Pressable>

          {ticks.map((tick) => (
            <Text key={tick} style={[styles.tickLabel, { top: y(tick) - 8, width: padLeft - 8 }]}>
              {tick}
            </Text>
          ))}
          {labels.map((label, index) =>
            index % stride === 0 || index === selected ? (
              <Text
                key={`${label}-${index}`}
                style={[
                  styles.monthLabel,
                  { top: height - padBottom + 8, left: x(index) - 18 },
                  index === selected && { color: colors.text, fontWeight: '700' },
                ]}
              >
                {label}
              </Text>
            ) : null,
          )}
          {lead ? (
            <View pointerEvents="none" style={[styles.tooltip, { left: tooltipLeft, top: Math.max(0, y(leadValue) - 46) }]}>
              <Text style={styles.tooltipText}>
                {labels[selected]}: {leadValue}
                {unit ? ` ${unit}` : ''}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Ring split into coloured segments, with anything (usually the main percentage) in the middle. */
export function Donut({
  segments,
  size = 132,
  thickness = 16,
  children,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  const centre = size / 2;
  let offset = 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={centre} cy={centre} r={radius} stroke={colors.border} strokeWidth={thickness} fill="none" />
        {segments.map((segment, index) => {
          const length = (segment.value / total) * circumference;
          const element = (
            <Circle
              key={index}
              cx={centre}
              cy={centre}
              r={radius}
              stroke={segment.color}
              strokeWidth={thickness}
              fill="none"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              rotation={-90}
              origin={`${centre}, ${centre}`}
            />
          );
          offset += length;
          return element;
        })}
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>{children}</View>
    </View>
  );
}

/** Vertical bars with a label under each; the tallest one is drawn in full colour. */
export function BarChart({
  labels,
  values,
  color,
  height = 150,
}: {
  labels: string[];
  values: number[];
  color: string;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      {values.map((value, index) => (
        <View key={`${labels[index]}-${index}`} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 11, color: colors.muted, height: 14 }}>{value > 0 ? value : ''}</Text>
          <View
            style={{
              width: '70%',
              maxWidth: 34,
              height: Math.max(4, (value / max) * height),
              borderRadius: 8,
              backgroundColor: value === max ? color : `${color}55`,
            }}
          />
          <Text style={{ fontSize: 11, color: colors.muted }}>{labels[index]}</Text>
        </View>
      ))}
    </View>
  );
}

/** Thin rounded progress bar, `value` from 0 to 100. */
export function ProgressBar({ value, color, track }: { value: number; color: string; track: string }) {
  return (
    <View style={[styles.track, { backgroundColor: track }]}>
      <View style={[styles.fill, { backgroundColor: color, width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
}

const styles = createStyles(() => StyleSheet.create({
  tickLabel: { position: 'absolute', left: 0, textAlign: 'right', fontSize: 11, color: colors.muted },
  monthLabel: { position: 'absolute', width: 36, textAlign: 'center', fontSize: 11, color: colors.muted },
  tooltip: {
    position: 'absolute',
    width: 112,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.navy,
    alignItems: 'center',
  },
  tooltipText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
}));
