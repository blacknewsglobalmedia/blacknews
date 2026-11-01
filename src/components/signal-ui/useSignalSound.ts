'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sonidos sintéticos (sin archivos): beep, ráfaga de estática, geiger.
 * Apagado por defecto. El audio solo arranca tras enable() (gesto del usuario).
 */
export function useSignalSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const onRef = useRef(false);
  const [enabled, setEnabled] = useState(false);

  const ctx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const enable = useCallback(() => { onRef.current = true; setEnabled(true); ctx(); }, [ctx]);
  const disable = useCallback(() => { onRef.current = false; setEnabled(false); }, []);

  const beep = useCallback((freq = 880, ms = 70, vol = 0.04) => {
    if (!onRef.current) return;
    const c = ctx(), o = c.createOscillator(), g = c.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
    o.connect(g).connect(c.destination);
    o.start(); o.stop(c.currentTime + ms / 1000);
  }, [ctx]);

  const burst = useCallback((ms = 220, vol = 0.05) => {
    if (!onRef.current) return;
    const c = ctx(), len = Math.floor(c.sampleRate * ms / 1000);
    const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.7; g.gain.value = vol;
    s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start();
  }, [ctx]);

  const geiger = useCallback((clicks = 6, vol = 0.05) => {
    if (!onRef.current) return;
    const c = ctx();
    for (let i = 0; i < clicks; i++) {
      const t = c.currentTime + Math.random() * 0.9;
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'square'; o.frequency.value = 2600 + Math.random() * 800;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.015);
    }
  }, [ctx]);

  useEffect(() => () => { void ctxRef.current?.close(); }, []);
  return { enabled, enable, disable, beep, burst, geiger };
}
