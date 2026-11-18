import { useCallback, useEffect, useRef, useState } from 'react';
import type { WeightUnit } from '../types';

/**
 * Lê o peso da balança pela porta USB/serial (Web Serial API).
 * Funciona no Google Chrome e no Microsoft Edge, em localhost ou HTTPS.
 */
export function useScale(baud: number, unit: WeightUnit) {
  const [kg, setKg] = useState(0);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReading = useRef(false);
  const unitRef = useRef<WeightUnit>(unit);
  unitRef.current = unit;

  const readLoop = useCallback(async () => {
    const port = portRef.current;
    if (!port) return;
    const decoder = new TextDecoder();
    let buffer = '';
    while (port.readable && keepReading.current) {
      const reader = port.readable.getReader();
      readerRef.current = reader;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value) continue;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 200) buffer = buffer.slice(-200);
          const found = buffer.match(/\d+[.,]\d+|\d+/g);
          if (found) {
            let v = parseFloat(found[found.length - 1].replace(',', '.'));
            if (unitRef.current === 'g') v = v / 1000;
            if (Number.isFinite(v) && v >= 0 && v < 500) setKg(v);
          }
        }
      } catch {
        // leitura cancelada ou interrompida
      } finally {
        reader.releaseLock();
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setError('Use o Google Chrome ou o Microsoft Edge para conectar a balança.');
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: baud || 9600 });
      portRef.current = port;
      keepReading.current = true;
      setConnected(true);
      setError('');
      void readLoop();
    } catch (e) {
      setError('Não foi possível conectar: ' + (e instanceof Error ? e.message : String(e)));
    }
  }, [baud, readLoop]);

  const disconnect = useCallback(async () => {
    keepReading.current = false;
    try {
      await readerRef.current?.cancel();
    } catch {
      /* ignora */
    }
    try {
      await portRef.current?.close();
    } catch {
      /* ignora */
    }
    portRef.current = null;
    setConnected(false);
    setKg(0);
  }, []);

  useEffect(
    () => () => {
      void disconnect();
    },
    [disconnect],
  );

  return { kg, connected, error, connect, disconnect };
}
