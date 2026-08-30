import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Mic, MicOff, X, Radio, Sparkles } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useVoiceCommand, type ParsedVoiceCommand } from '@/hooks/useVoiceCommand';

interface VoiceCommandFloatingButtonProps {
  onCommand: (cmd: ParsedVoiceCommand) => void;
}

export function VoiceCommandFloatingButton({ onCommand }: VoiceCommandFloatingButtonProps) {
  const insets = useSafeAreaInsets();
  const [active, setActive] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const voice = useVoiceCommand(onCommand);

  const handleToggle = useCallback(() => {
    if (active) {
      voice.stop();
      setActive(false);
    } else {
      voice.start();
      setActive(true);
    }
  }, [active, voice]);

  useEffect(() => {
    if (voice.state === 'error') {
      setActive(false);
    }
  }, [voice.state]);

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
        <TouchableOpacity
          style={[
            styles.button,
            isListening && styles.buttonActive,
            voice.state === 'error' && styles.buttonError,
          ]}
          onPress={handleToggle}
          onLongPress={() => setShowHelp(true)}
          activeOpacity={0.7}
        >
          {isListening ? (
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
              {voice.partialTranscript || '음성 대기 중...'}
            </Text>
          </View>
        )}
      </View>

      {/* Help modal */}
      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.overlay}>
          <View style={styles.helpCard}>
            <View style={styles.helpHeader}>
              <Sparkles size={20} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.helpTitle}>핸즈프리 음성 명령</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)} activeOpacity={0.7}>
                <X size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.helpDesc}>
              손에 기름이나 물이 묻었을 때, 화면을 터치하지 않고 목소리만으로 숏폼을 만들 수 있어요.
            </Text>

            <View style={styles.helpStep}>
              <Text style={styles.helpStepNum}>1</Text>
              <View style={styles.helpStepBody}>
                <Text style={styles.helpStepTitle}>마이크 버튼을 탭하세요</Text>
                <Text style={styles.helpStepSub}>버튼이 빨간색으로 깜빡이면 음성 대기 중</Text>
              </View>
            </View>

            <View style={styles.helpStep}>
              <Text style={styles.helpStepNum}>2</Text>
              <View style={styles.helpStepBody}>
                <Text style={styles.helpStepTitle}>웨이크워드를 말하세요</Text>
                <Text style={styles.helpStepSub}>"숏커넥트" 또는 "뚝딱"이라고 외치세요</Text>
              </View>
            </View>

            <View style={styles.helpStep}>
              <Text style={styles.helpStepNum}>3</Text>
              <View style={styles.helpStepBody}>
                <Text style={styles.helpStepTitle}>홍보 멘트를 덧붙이세요</Text>
                <Text style={styles.helpStepSub}>"숏커넥트, 오늘 남은 항정살 마감 떨이!"</Text>
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
              음성 명령이 감지되면 자동으로 숏폼 제작 화면으로 이동하고 홍보 만들기가 시작됩니다.
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
  pulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.colors.error[400],
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
