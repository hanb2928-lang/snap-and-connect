import {
  generateEmotionCurve,
  getEmotionParamsAtTime,
  buildTtsInstructionsForPhase,
  splitTextForEmotionCurve,
  enableVoiceCloning,
  getPhaseLabel,
  getPhaseEmoji,
  EMOTION_PHASES,
  type EmotionPhase,
} from '@/lib/ttsEmotionCurve';

describe('ttsEmotionCurve', () => {
  describe('EMOTION_PHASES', () => {
    it('has 3 phases', () => {
      expect(Object.keys(EMOTION_PHASES)).toHaveLength(3);
    });

    it('doubt phase has higher speed', () => {
      expect(EMOTION_PHASES.doubt.speed).toBeGreaterThan(1.0);
    });

    it('surprise phase has pause', () => {
      expect(EMOTION_PHASES.surprise.pauseSec).toBeGreaterThan(0);
    });

    it('conviction phase has style exaggeration', () => {
      expect(EMOTION_PHASES.conviction.styleExaggeration).toBeGreaterThan(0.1);
    });
  });

  describe('generateEmotionCurve', () => {
    it('generates 3 segments for a 15s video', () => {
      const curve = generateEmotionCurve(15);
      expect(curve.segments).toHaveLength(3);
      expect(curve.totalDurationSec).toBe(15);
    });

    it('first segment starts at 0', () => {
      const curve = generateEmotionCurve(15);
      expect(curve.segments[0].startSec).toBe(0);
    });

    it('last segment ends at total duration', () => {
      const curve = generateEmotionCurve(15);
      expect(curve.segments[curve.segments.length - 1].endSec).toBe(15);
    });

    it('phases are in order: doubt, surprise, conviction', () => {
      const curve = generateEmotionCurve(15);
      expect(curve.segments[0].phase).toBe('doubt');
      expect(curve.segments[1].phase).toBe('surprise');
      expect(curve.segments[2].phase).toBe('conviction');
    });

    it('voiceCloningReady defaults to false', () => {
      const curve = generateEmotionCurve(15);
      expect(curve.voiceCloningReady).toBe(false);
    });
  });

  describe('getEmotionParamsAtTime', () => {
    it('returns doubt phase at t=1', () => {
      const curve = generateEmotionCurve(15);
      const params = getEmotionParamsAtTime(curve, 1);
      expect(params?.phase).toBe('doubt');
    });

    it('returns surprise phase at t=5', () => {
      const curve = generateEmotionCurve(15);
      const params = getEmotionParamsAtTime(curve, 5);
      expect(params?.phase).toBe('surprise');
    });

    it('returns conviction phase at t=10', () => {
      const curve = generateEmotionCurve(15);
      const params = getEmotionParamsAtTime(curve, 10);
      expect(params?.phase).toBe('conviction');
    });

    it('returns null for out of range', () => {
      const curve = generateEmotionCurve(15);
      const params = getEmotionParamsAtTime(curve, 20);
      expect(params).toBeNull();
    });
  });

  describe('buildTtsInstructionsForPhase', () => {
    it('includes phase guide', () => {
      const instructions = buildTtsInstructionsForPhase('doubt');
      expect(instructions).toContain('curiosity');
    });

    it('appends base instructions when provided', () => {
      const instructions = buildTtsInstructionsForPhase('surprise', 'Base voice instructions');
      expect(instructions).toContain('Base voice instructions');
      expect(instructions).toContain('pause');
    });
  });

  describe('splitTextForEmotionCurve', () => {
    it('produces 3 segments', () => {
      const curve = generateEmotionCurve(15);
      const segments = splitTextForEmotionCurve('이거 진짜 좋아요. 한번 써보세요. 최고예요.', curve, 'alloy');
      expect(segments).toHaveLength(3);
    });

    it('each segment has speed and instructions', () => {
      const curve = generateEmotionCurve(15);
      const segments = splitTextForEmotionCurve('이거 진짜 좋아요. 한번 써보세요. 최고예요.', curve, 'alloy');
      segments.forEach((seg) => {
        expect(seg.speed).toBeGreaterThan(0);
        expect(seg.instructions).toBeTruthy();
        expect(seg.voice).toBe('alloy');
      });
    });
  });

  describe('enableVoiceCloning', () => {
    it('sets voiceCloningReady to true', () => {
      const curve = generateEmotionCurve(15);
      const cloned = enableVoiceCloning(curve);
      expect(cloned.voiceCloningReady).toBe(true);
    });
  });

  describe('getPhaseLabel / getPhaseEmoji', () => {
    it('returns correct labels', () => {
      expect(getPhaseLabel('doubt')).toBe('의구심');
      expect(getPhaseLabel('surprise')).toBe('놀람');
      expect(getPhaseLabel('conviction')).toBe('확신');
    });

    it('returns correct emojis', () => {
      expect(getPhaseEmoji('doubt')).toBe('🤔');
      expect(getPhaseEmoji('surprise')).toBe('😱');
      expect(getPhaseEmoji('conviction')).toBe('💪');
    });
  });
});
