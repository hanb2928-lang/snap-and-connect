import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

type RecordingState = 'idle' | 'recording' | 'stopped' | 'error';

interface MediaRecorderLike {
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  state: RecordingState;
  duration: number;
  error: string | null;
}

const MAX_DURATION_SEC = 30;

export function useVoiceRecording(): MediaRecorderLike {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setDuration(0);

    if (Platform.OS !== 'web') {
      setError('이 기기에서는 음성 녹음을 지원하지 않습니다.');
      setState('error');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('마이크 접근 권한이 필요합니다.');
      setState('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setState('recording');

      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= MAX_DURATION_SEC) {
            recorder.stop();
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch {
      setError('마이크 권한을 허용해주세요.');
      setState('error');
    }
  }, [cleanup]);

  const stop = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cleanup();
      setState('idle');
      return null;
    }

    return new Promise<string | null>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          cleanup();
          setState('stopped');
          resolve(dataUrl);
        };
        reader.onerror = () => {
          cleanup();
          setState('error');
          setError('녹음 파일을 읽지 못했습니다.');
          resolve(null);
        };
        reader.readAsDataURL(blob);
      };

      recorder.stop();
    });
  }, [cleanup]);

  return { start, stop, state, duration, error };
}
