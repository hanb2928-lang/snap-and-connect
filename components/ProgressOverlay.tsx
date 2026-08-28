import { useEffect, useState } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { AnalysisLoadingOverlay } from '@/components/AnalysisLoadingOverlay';
import { ProgressBarBabyRun } from '@/components/ProgressBarBabyRun';
import { ProgressBarStatus } from '@/components/ProgressBarStatus';
import { getUserSettings } from '@/lib/settings';

type ProgressStep = 0 | 1 | 2 | 3;
type ProgressStyle = 'circular' | 'baby-run' | 'status-bar';

interface ProgressOverlayProps {
  progressSV: SharedValue<number>;
  step: ProgressStep;
  text: string;
  stepLabels?: [string, string, string];
  styleOverride?: ProgressStyle;
}

export function ProgressOverlay({ progressSV, step, text, stepLabels, styleOverride }: ProgressOverlayProps) {
  const [style, setStyle] = useState<ProgressStyle>(styleOverride ?? 'circular');

  useEffect(() => {
    if (styleOverride) {
      setStyle(styleOverride);
      return;
    }
    let mounted = true;
    getUserSettings()
      .then((settings) => {
        if (mounted && settings?.progress_style) {
          setStyle(settings.progress_style as ProgressStyle);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [styleOverride]);

  if (style === 'baby-run') {
    return <ProgressBarBabyRun progressSV={progressSV} step={step} text={text} />;
  }
  if (style === 'status-bar') {
    return <ProgressBarStatus progressSV={progressSV} step={step} text={text} />;
  }
  return <AnalysisLoadingOverlay progressSV={progressSV} step={step} text={text} stepLabels={stepLabels} />;
}
