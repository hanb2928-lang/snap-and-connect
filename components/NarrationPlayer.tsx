import { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Volume2, Play, Pause, Loader2, RefreshCw, AlertCircle } from 'lucide-react-native';
import { theme } from '@/lib/theme';

interface NarrationPlayerProps {
  ttsUrl: string | null;
  ttsLoading: boolean;
  narrationText: string;
  onRegenerate?: () => void;
}

export function NarrationPlayer({ ttsUrl, ttsLoading, narrationText, onRegenerate }: NarrationPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (!ttsUrl) return;
    setPlayError(null);

    if (Platform.OS !== 'web') {
      setPlayError('웹에서만 재생할 수 있습니다');
      return;
    }

    try {
      if (isPlaying && audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(ttsUrl);
      audioRef.current = audio;
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        setPlayError('오디오 재생에 실패했습니다');
      };
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
      setPlayError('재생을 시작할 수 없습니다');
    }
  }, [ttsUrl, isPlaying]);

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

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.playBtn, !hasAudio && styles.playBtnDisabled]}
          onPress={handlePlayPause}
          disabled={!hasAudio}
          activeOpacity={0.7}
        >
          {ttsLoading && !hasAudio ? (
            <ActivityIndicator size={16} color="#fff" />
          ) : isPlaying ? (
            <Pause size={16} color="#fff" strokeWidth={2} />
          ) : (
            <Play size={16} color="#fff" strokeWidth={2} fill="#fff" />
          )}
          <Text style={styles.playBtnText}>
            {ttsLoading && !hasAudio ? '생성 중...' : isPlaying ? '일시정지' : '재생'}
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
