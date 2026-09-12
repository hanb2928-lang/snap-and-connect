import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Volume2, Play, Pause, Loader2, RefreshCw, AlertCircle, VolumeX } from 'lucide-react-native';
import { theme } from '@/lib/theme';

interface NarrationPlayerProps {
  ttsUrl: string | null;
  ttsLoading: boolean;
  narrationText: string;
  onRegenerate?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
}

export function NarrationPlayer({ ttsUrl, ttsLoading, narrationText, onRegenerate, onPlayStateChange }: NarrationPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [needsTouchRetry, setNeedsTouchRetry] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const notifyPlayState = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    onPlayStateChange?.(playing);
  }, [onPlayStateChange]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch { /* ignore */ }
        sourceNodeRef.current = null;
      }
      if (masterGainRef.current && audioCtxRef.current) {
        try { masterGainRef.current.disconnect(); } catch { /* ignore */ }
        masterGainRef.current = null;
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch { /* ignore */ }
        audioCtxRef.current = null;
      }
    };
  }, []);

  /**
   * User Gesture Unlock — 재생 버튼 클릭 시 즉시 AudioContext를 생성/resume하고
   * 무음 펄스를 재생하여 브라우저 자동재생 잠금을 해제한다.
   */
  const unlockAudioContext = useCallback((): AudioContext | null => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return null;

    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      masterGainRef.current = gain;
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // 무음 펄스 재생으로 잠금 해제
    try {
      const pulse = ctx.createOscillator();
      const pulseGain = ctx.createGain();
      pulseGain.gain.value = 0.0001;
      pulse.connect(pulseGain);
      pulseGain.connect(ctx.destination);
      pulse.start();
      pulse.stop(ctx.currentTime + 0.01);
    } catch {
      /* ignore */
    }

    return ctx;
  }, []);

  /**
   * 오디오 버퍼가 충분히 로드될 때까지 대기한 후 play() 실행.
   * canplaythrough 이벤트를 대기하거나 readyState >= 3을 확인한다.
   */
  const playWhenReady = useCallback((audio: HTMLAudioElement): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('timeout'));
      }, 10000);

      const startPlayback = () => {
        clearTimeout(timeout);
        audio.removeEventListener('canplaythrough', startPlayback);
        audio.removeEventListener('loadeddata', startPlayback);
        audio.play().then(resolve).catch(reject);
      };

      if (audio.readyState >= 3) {
        clearTimeout(timeout);
        audio.play().then(resolve).catch(reject);
      } else {
        audio.addEventListener('canplaythrough', startPlayback);
        audio.addEventListener('loadeddata', startPlayback);
        audio.load();
      }
    });
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!ttsUrl) return;
    setPlayError(null);
    setNeedsTouchRetry(false);

    if (Platform.OS !== 'web') {
      setPlayError('웹에서만 재생할 수 있습니다');
      return;
    }

    // 일시정지 요청
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      notifyPlayState(false);
      return;
    }

    // 기존 오디오 정리
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    setIsLoading(true);

    try {
      // 1. User Gesture Unlock — 즉시 AudioContext resume + 무음 펄스
      const ctx = unlockAudioContext();

      // 2. 새 오디오 엘리먼트 생성
      const audio = new Audio();
      audio.src = ttsUrl;
      audio.volume = 1.0;
      audio.muted = false;
      audio.loop = false;
      audio.crossOrigin = 'anonymous';
      audio.preload = 'auto';
      audioRef.current = audio;

      audio.onended = () => notifyPlayState(false);
      audio.onpause = () => {
        // pause() 호출에 의한 일시정지만 반영
        if (audioRef.current === audio && !audio.ended) {
          notifyPlayState(false);
        }
      };
      audio.onerror = () => {
        setIsLoading(false);
        notifyPlayState(false);
        setPlayError('오디오 재생에 실패했습니다');
      };

      // 3. Web Audio API에 연결 (AudioContext가 있는 경우)
      if (ctx && masterGainRef.current) {
        try {
          // 기존 sourceNode가 있으면 disconnect
          if (sourceNodeRef.current) {
            try { sourceNodeRef.current.disconnect(); } catch { /* ignore */ }
          }
          const source = ctx.createMediaElementSource(audio);
          source.connect(masterGainRef.current);
          sourceNodeRef.current = source;
        } catch {
          // createMediaElementSource 실패 시 일반 재생으로 폴백
        }
      }

      // 4. 버퍼 로드 대기 후 play() 실행
      await playWhenReady(audio);
      setIsLoading(false);
      notifyPlayState(true);
    } catch (err) {
      setIsLoading(false);
      notifyPlayState(false);

      const errMsg = err instanceof Error ? err.message : String(err);

      // 브라우저 자동재생 차단 — muted 재생 후 터치 재시도 안내
      if (errMsg.includes('NotAllowed') || errMsg.includes('not allowed') || errMsg.includes('user gesture') || errMsg.includes('NotAllowedError')) {
        try {
          if (audioRef.current) {
            audioRef.current.muted = true;
            await audioRef.current.play();
            notifyPlayState(true);
            setNeedsTouchRetry(true);
            setPlayError('브라우저 정책으로 인해 일시적으로 무음 재생됩니다. 다시 한 번 재생 버튼을 눌러주세요.');
          }
        } catch {
          setPlayError('재생을 시작할 수 없습니다. 다시 한 번 재생 버튼을 눌러주세요.');
        }
      } else if (errMsg.includes('timeout')) {
        setPlayError('오디오 로딩 시간이 초과되었습니다. 다시 시도해주세요.');
      } else {
        setPlayError('재생을 시작할 수 없습니다');
      }
    }
  }, [ttsUrl, isPlaying, notifyPlayState, unlockAudioContext, playWhenReady]);

  /**
   * 무음 재생 상태에서 사용자가 다시 터치하면 muted 해제 후 정상 재생.
   */
  const handleTouchRetry = useCallback(async () => {
    if (!audioRef.current) return;
    setNeedsTouchRetry(false);
    setPlayError(null);

    const ctx = unlockAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    audioRef.current.muted = false;
    audioRef.current.volume = 1.0;
    if (audioRef.current.paused) {
      try {
        await audioRef.current.play();
        notifyPlayState(true);
      } catch {
        setPlayError('재생을 시작할 수 없습니다');
      }
    } else {
      notifyPlayState(true);
    }
  }, [unlockAudioContext, notifyPlayState]);

  const handlePlayPress = useCallback(() => {
    if (needsTouchRetry) {
      handleTouchRetry();
    } else {
      handlePlayPause();
    }
  }, [needsTouchRetry, handleTouchRetry, handlePlayPause]);

  const hasAudio = !!ttsUrl;
  const previewText = narrationText.length > 80 ? narrationText.slice(0, 80) + '...' : narrationText;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Volume2 size={16} color={theme.colors.primary[400]} strokeWidth={2} />
        <Text style={styles.title}>AI 나레이션</Text>
        {ttsLoading && !hasAudio && (
          <View style={styles.generatingBadge}>
            <Loader2 size={11} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.generatingText}>생성 중</Text>
          </View>
        )}
        {hasAudio && (
          <View style={styles.readyBadge}>
            <Text style={styles.readyText}>준비됨</Text>
          </View>
        )}
      </View>

      {previewText && (
        <Text style={styles.previewText} numberOfLines={2}>{previewText}</Text>
      )}

      {playError && (
        <View style={styles.errorRow}>
          <AlertCircle size={12} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>{playError}</Text>
        </View>
      )}

      {needsTouchRetry && (
        <View style={styles.retryHintRow}>
          <VolumeX size={12} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.retryHintText}>소리를 들으려면 재생 버튼을 다시 눌러주세요</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.playBtn, !hasAudio && styles.playBtnDisabled]}
          onPress={handlePlayPress}
          disabled={!hasAudio || isLoading}
          activeOpacity={0.7}
        >
          {isLoading ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : isPlaying && !needsTouchRetry ? (
            <Pause size={16} color="#fff" strokeWidth={2} />
          ) : needsTouchRetry ? (
            <VolumeX size={16} color={theme.colors.warning[400]} strokeWidth={2} />
          ) : (
            <Play size={16} color="#fff" strokeWidth={2} fill="#fff" />
          )}
          <Text style={styles.playBtnText}>
            {isLoading ? '로딩 중...' : isPlaying && !needsTouchRetry ? '일시정지' : needsTouchRetry ? '소리 켜기' : '재생'}
          </Text>
        </TouchableOpacity>

        {onRegenerate && hasAudio && (
          <TouchableOpacity
            style={styles.regenerateBtn}
            onPress={onRegenerate}
            activeOpacity={0.7}
          >
            <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
            <Text style={styles.regenerateBtnText}>다시 생성</Text>
          </TouchableOpacity>
        )}
      </View>

      {ttsLoading && !hasAudio && (
        <Text style={styles.hintText}>
          AI가 분석 결과를 바탕으로 자연스러운 한국어 나레이션을 생성하고 있습니다. 완료되면 자동으로 재생 버튼이 활성화됩니다.
        </Text>
      )}

      {!ttsLoading && !hasAudio && (
        <Text style={styles.hintText}>
          분석이 완료되면 AI 나레이션이 자동 생성됩니다.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.dark.text,
    flex: 1,
  },
  generatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary[400] + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  generatingText: {
    fontSize: 11,
    color: theme.colors.primary[300],
    fontWeight: '500',
  },
  readyBadge: {
    backgroundColor: theme.colors.success[400] + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  readyText: {
    fontSize: 11,
    color: theme.colors.success[400],
    fontWeight: '500',
  },
  previewText: {
    fontSize: 13,
    color: theme.colors.dark.textDim,
    lineHeight: 19,
    marginBottom: 12,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 12,
    color: theme.colors.error[400],
  },
  retryHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  retryHintText: {
    fontSize: 12,
    color: theme.colors.warning[400],
    fontWeight: '500',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[400],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  playBtnDisabled: {
    backgroundColor: theme.colors.dark.border,
  },
  playBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  regenerateBtnText: {
    fontSize: 13,
    color: theme.colors.dark.textDim,
  },
  hintText: {
    fontSize: 12,
    color: theme.colors.dark.textFaint,
    lineHeight: 17,
    marginTop: 10,
  },
});
