// Microphone and camera pickers for the browser. See DevicePickers.tsx for the native stand-in.
import type { CSSProperties } from 'react';

import type { CallRecorder, MediaDeviceOption } from './types';

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  fontSize: 12,
  fontWeight: 600,
  color: '#6b7280',
  flex: '1 1 200px',
  minWidth: 0,
};

const selectStyle: CSSProperties = {
  height: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid #e3e5ec',
  background: '#ffffff',
  color: '#1b1f2a',
  fontSize: 14,
  maxWidth: '100%',
};

function Picker({
  caption,
  options,
  value,
  disabled,
  onChange,
}: {
  caption: string;
  options: MediaDeviceOption[];
  value: string | null;
  disabled?: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label style={labelStyle}>
      {caption}
      <select
        style={{ ...selectStyle, opacity: disabled ? 0.5 : 1 }}
        value={value ?? ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function DevicePickers({ recorder, disabled }: { recorder: CallRecorder; disabled?: boolean }) {
  const { microphones, cameras, microphoneId, cameraId } = recorder.devices;
  if (microphones.length === 0 && cameras.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
      {microphones.length > 0 ? (
        <Picker
          caption="Microphone"
          options={microphones}
          value={microphoneId}
          disabled={disabled}
          onChange={(id) => void recorder.selectMicrophone(id)}
        />
      ) : null}
      {cameras.length > 0 ? (
        <Picker
          caption="Camera"
          options={cameras}
          value={cameraId}
          disabled={disabled}
          onChange={(id) => void recorder.selectCamera(id)}
        />
      ) : null}
    </div>
  );
}
