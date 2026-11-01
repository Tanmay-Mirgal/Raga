import React, { useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { usePlaybackProgress } from '../context/playbackProgress';
import { formatTime } from '../utils/format';

interface Props {
  onSeek: (millis: number) => void;
}

/** Draggable progress bar with time labels. Tap or drag to seek. */
export default function SeekBar({ onSeek }: Props) {
  const { position, duration, buffered } = usePlaybackProgress();
  const [width, setWidth] = useState(1);
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const widthRef = useRef(1);
  widthRef.current = width;
  const durationRef = useRef(0);
  durationRef.current = duration;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;
  const lastFraction = useRef(0);

  const toFraction = (x: number) => Math.max(0, Math.min(1, x / widthRef.current));

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        lastFraction.current = toFraction(e.nativeEvent.locationX);
        setDragFraction(lastFraction.current);
      },
      onPanResponderMove: (e, g) => {
        // locationX is relative to the touched child; use dx from the grant point instead.
        const start = lastFraction.current;
        const next = Math.max(0, Math.min(1, start + g.dx / widthRef.current));
        setDragFraction(next);
      },
      onPanResponderRelease: (e, g) => {
        const next = Math.max(0, Math.min(1, lastFraction.current + g.dx / widthRef.current));
        setDragFraction(null);
        if (durationRef.current > 0) onSeekRef.current(next * durationRef.current);
      },
      onPanResponderTerminate: () => setDragFraction(null),
    })
  ).current;

  const live = duration > 0 ? Math.min(1, position / duration) : 0;
  const fraction = dragFraction ?? live;
  const shownPosition = dragFraction != null ? dragFraction * duration : position;
  const bufferedFraction = duration > 0 ? Math.min(1, buffered / duration) : 0;

  return (
    <View>
      <View style={styles.touchArea} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} {...pan.panHandlers}>
        <View style={styles.track} pointerEvents="none">
          <View style={[styles.buffered, { width: `${bufferedFraction * 100}%` }]} />
          <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        </View>
        <View
          pointerEvents="none"
          style={[styles.knob, dragFraction != null && styles.knobActive, { left: fraction * width - (dragFraction != null ? 8 : 6) }]}
        />
      </View>
      <View style={styles.labels}>
        <Text style={styles.time}>{formatTime(shownPosition)}</Text>
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: { height: 28, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  buffered: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.18)' },
  fill: { height: '100%', backgroundColor: '#FFFFFF' },
  knob: { position: 'absolute', top: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  knobActive: { top: 6, width: 16, height: 16, borderRadius: 8 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  time: { color: '#B3B3B3', fontSize: 12 },
});
