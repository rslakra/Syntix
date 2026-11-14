// Native camera preview; it is also the view that records video. See CallPreview.web.tsx.
import { CameraView } from 'expo-camera';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import type { PreviewProps } from './types';

/**
 * `fill` makes the camera cover its parent (the tile in the lobby or in the call). `fit` is accepted
 * for parity with the browser version: the native camera view always fills its parent, so the call
 * keeps its tile a sensible size instead.
 */
export function CallPreview({
  preview,
  fill = true,
}: {
  preview: PreviewProps;
  fill?: boolean;
  fit?: 'cover' | 'contain';
}) {
  const { onCameraReleased } = preview;
  useEffect(() => () => onCameraReleased(), [onCameraReleased]);

  if (!preview.video) return null;
  return (
    <CameraView
      ref={preview.cameraRef}
      style={fill ? StyleSheet.absoluteFill : styles.card}
      mode="video"
      facing="front"
      mute={preview.mute}
      onCameraReady={preview.onCameraReady}
      onMountError={(event) => preview.onCameraError(event.message)}
    />
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', height: 320, overflow: 'hidden', backgroundColor: '#000' },
});
