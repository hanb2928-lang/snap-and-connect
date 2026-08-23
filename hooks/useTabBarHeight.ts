import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return 64 + Math.max(insets.bottom, 0);
}
