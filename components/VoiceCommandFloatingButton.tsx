import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform, Animated } from 'react-native';
import { Mic, MicOff, X, Radio, Sparkles, Ear } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceCommand, type ParsedVoiceCommand } from '@/hooks/useVoiceCommand';
import { getItem, setItem } from '@/lib/storage';

interface VoiceCommandFloatingButtonProps {
  onCommand: (cmd: ParsedVoiceCommand) => void;
}

export function VoiceCommandFloatingButton({ onCommand }: VoiceCommandFloatingButtonProps) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [justWoke, setJustWoke] = useState(false);
  const autoStartedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  const handleCommandWithFlash = useCallback((cmd: ParsedVoiceCommand) => {
    setJustWoke(true);
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setJustWoke(false));
    onCommandRef.current(cmd);
  }, [pulseAnim]);

  const voice = useVoiceCommand(handleCommandWithFlash);

  const handleToggle = useCallback(() => {
    if (active) {
      voice.stop();
      setActive(false);
      setItem('voice_always_on', 'false');
    } else {
      voice.start();
      setActive(true);
      setItem('voice_always_on', 'true');
    }
  }, [active, voice]);

  useEffect(() => {
    if (voice.state === 'error') {
      setActive(false);
    }
  }, [voice.state]);

  // Auto-start listening on mount — like Bixby, phone is always listening for the wake word
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    (async () => {
      if (Platform.OS !== 'web') return;
      try {
        const alwaysOn = await getItem('voice_always_on');
        // Default to always-on. If user explicitly turned it off, respect that.
        if (alwaysOn !== 'false') {
          voice.start();
          setActive(true);
          await setItem('voice_always_on', 'true');
        }
      } catch {}
    })();
  }, [voice]);

  const isListening = active && voice.state === 'listening';

  if (Platform.OS !== 'web') return null;

  return (
    <>
      <View
        style={[
          styles.container,
          { top: insets.top + 56 },
        ]}
      >
        {/* Always-on ear indicator */}
        {active && (
          <Animated.View
            style={[
              styles.alwaysOnBadge,
              justWoke && {
                opacity: pulseAnim,
                transform: [{
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.15],
                  }),
                }],
              },
            ]}
          >
            <Ear size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.alwaysOnText}>항상 대기</Text>
          </Animated.View>
        )}

        <TouchableOpacity
          style={[
            styles.button,
            isListening && styles.buttonActive,
            voice.state === 'error' && styles.buttonError,
            justWoke && styles.buttonWoke,
          ]}
          onPress={handleToggle}
          onLongPress={() => setShowHelp(true)}
          activeOpacity={0.7}
        >
          {justWoke ? (
            <Sparkles size={22} color={theme.colors.primary[200]} strokeWidth={2.5} />
          ) : isListening ? (
            <Radio size={22} color="#fff" strokeWidth={2.5} />
          ) : voice.state === 'error' ? (
            <MicOff size={22} color={theme.colors.error[400]} strokeWidth={2.2} />
          ) : (
            <Mic size={22} color={theme.colors.primary[300]} strokeWidth={2.2} />
          )}
          {isListening && <View style={styles.pulseRing} />}
        </TouchableOpacity>

        {isListening && (
          <View style={styles.statusBubble}>
            <View style={styles.dotRow}>
              <View style={[styles.liveDot, styles.liveDot1]} />
              <View style={[styles.liveDot, styles.liveDot2]} />
              <View style={[styles.liveDot, styles.liveDot3]} />
            </View>
            <Text style={styles.statusText} numberOfLines={1}>
              {voice.partialTranscript || '"숏커넥트"라고 불러주세요'}
            </Text>
          </View>
        )}

        {voice.state === 'error' && voice.error && (
          <View style={styles.errorBubble}>
            <Text style={styles.errorText} numberOfLines={2}>{voice.error}</Text>
          </View>
        )}
      </View>

      {/* Help modal */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.overlay}>
          <View style={styles.helpCard}>
            <View style={styles.helpHeader}>
              <Sparkles size={20} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.helpTitle}>빅스처럼 음성으로 깨우기</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.helpDesc}>
              폰을 놔두고 "숏커넥트"라고 부르면, 주방이나 홀에서 손을 닦지 않고도 숏폼을 만들 수 있어요. 카메라 화면에 들어오면 자동으로 듣기 시작합니다.
            </Text>

            <View style={styles.helpStep}>
              <Text style={styles.helpStepNum}>1</Text>
              <View style={styles.helpStepBody}>
                <Text style={styles.helpStepTitle}>그냥 "숏커넥트"라고 부르세요</Text>
                <Text style={styles.helpStepSub}>버튼을 누를 필요 없이 자동으로 듣고 있어요</Text>
              </View>
            </View>

            <View style={styles.helpStep}>
              <Text style={styles.helpStepNum}>2</Text>
              <View style={styles.helpStepBody}>
                <Text style={styles.helpStepTitle}>웨이크워드 + 홍보 멘트</Text>
                <Text style={styles.helpStepSub}>"숏커넥트, 오늘 남은 항정살 마감 떨이!"</Text>
              </View>
            </View>

            <View style={styles.helpStep}>
              <Text style={styles.helpStepNum}>3</Text>
              <View style={styles.helpStepBody}>
                <Text style={styles.helpStepTitle}>자동으로 숏폼 제작 시작</Text>
                <Text style={styles.helpStepSub}>말이 끝나면 홍보 만들기가 자동으로 실행됩니다</Text>
              </View>
            </View>

            <View style={styles.helpKeywordBox}>
              <Text style={styles.helpKeywordTitle}>인식 키워드</Text>
              <View style={styles.helpKeywordRow}>
                {['마감', '떨이', '신메뉴', '할인', '서비스', '특가', '한정'].map((kw) => (
                  <View key={kw} style={styles.helpKeywordChip}>
                    <Text style={styles.helpKeywordText}>{kw}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.helpNote}>
              음성 대기를 끄려면 마이크 버튼을 한 번 더 탭하세요. 다음에 카메라 화면에 들어올 때 다시 켜집니다.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: theme.spacing.md,
    zIndex: 30,
    alignItems: 'flex-end',
    gap: 8,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadows.card,
  },
  buttonActive: {
    backgroundColor: theme.colors.error[500],
    borderColor: theme.colors.error[400],
  },
  buttonError: {
    borderColor: theme.colors.error[400],
  },
  buttonWoke: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[400],
  },
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.colors.error[400],
  },
  alwaysOnBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.success[500] + '18',
    borderRadius: theme.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '30',
  },
  alwaysOnText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  statusBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    maxWidth: 220,
    ...theme.shadows.card,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.error[400],
  },
  liveDot1: { opacity: 1 },
  liveDot2: { opacity: 0.6 },
  liveDot3: { opacity: 0.3 },
  errorBubble: {
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '30',
    maxWidth: 200,
  },
  errorText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'right',
  },
  statusText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  helpCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    width: '100%',
    maxWidth: 360,
    gap: theme.spacing.md,
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  helpTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  helpDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 19,
  },
  helpStep: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  helpStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary[500],
    color: '#fff',
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 24,
  },
  helpStepBody: {
    flex: 1,
    gap: 2,
  },
  helpStepTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  helpStepSub: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  helpKeywordBox: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 8,
  },
  helpKeywordTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  helpKeywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  helpKeywordChip: {
    backgroundColor: theme.colors.primary[500] + '20',
    borderRadius: theme.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  helpKeywordText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  helpNote: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
});


export { VoiceCommandFloatingButton }