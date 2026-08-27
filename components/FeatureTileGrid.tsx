import { useState, useCallback, useRef, useEffect, useMemo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ScrollView,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { LazySection } from '@/components/LazySection';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type ScanMode = 'single' | 'multi' | 'template';

export type FeatureTile = {
  key: string;
  label: string;
  icon: ReactNode;
  category: string;
  modes?: ScanMode[];
  render: () => ReactNode;
};

export type FeatureCategory = {
  key: string;
  label: string;
  tiles: FeatureTile[];
};

type Props = {
  categories: FeatureCategory[];
  scanMode?: ScanMode;
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_GAP = theme.spacing.sm;
const CARD_MIN_WIDTH = Math.max(150, (SCREEN_WIDTH - theme.spacing.lg * 2 - CARD_GAP * 2) / 3);

export function FeatureTileGrid({ categories, scanMode }: Props) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const tabScrollRef = useRef<ScrollView>(null);
  const indicatorX = useRef(new RNAnimated.Value(0)).current;

  const selectCategory = useCallback((index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveCategory(index);
    setExpandedKey(null);
  }, []);

  const toggle = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  const filteredCategories = useMemo(() => {
    if (!scanMode) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        tiles: cat.tiles.filter((tile) => !tile.modes || tile.modes.includes(scanMode)),
      }))
      .filter((cat) => cat.tiles.length > 0);
  }, [categories, scanMode]);

  const currentCategory = filteredCategories[activeCategory] ?? filteredCategories[0];

  return (
    <View style={styles.wrap}>
      <View style={styles.tabBarContainer}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {filteredCategories.map((category, index) => {
            const isActive = index === activeCategory;
            return (
              <TouchableOpacity
                key={category.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => selectCategory(index)}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  numberOfLines={1}
                >
                  {category.label}
                </Text>
                <View style={[styles.tabDot, isActive && styles.tabDotActive]} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.gridContainer}>
        <View style={styles.cardGrid}>
          {currentCategory.tiles.map((tile) => {
            const isExpanded = expandedKey === tile.key;
            return (
              <TouchableOpacity
                key={tile.key}
                style={[
                  styles.card,
                  isExpanded && styles.cardExpanded,
                  expandedKey && !isExpanded && styles.cardDimmed,
                ]}
                onPress={() => toggle(tile.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.cardIconWrap, isExpanded && styles.cardIconWrapActive]}>
                  {tile.icon}
                </View>
                <Text
                  style={[styles.cardLabel, isExpanded && styles.cardLabelActive]}
                  numberOfLines={1}
                >
                  {tile.label}
                </Text>
                <ChevronDown
                  size={14}
                  color={isExpanded ? theme.colors.primary[300] : theme.colors.dark.textFaint}
                  strokeWidth={2.5}
                  style={isExpanded ? styles.chevronRotated : undefined}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {expandedKey && (
          <LazySection delayMs={50}>
            <View style={styles.expandedPanel}>
              {currentCategory.tiles
                .filter((t) => t.key === expandedKey)
                .map((t) => (
                  <View key={t.key}>{t.render()}</View>
                ))}
            </View>
          </LazySection>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.md,
  },
  tabBarContainer: {
    flexDirection: 'row',
  },
  tabBarScroll: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    paddingVertical: 2,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    ...theme.shadows.card,
  },
  tabActive: {
    backgroundColor: theme.colors.primary[500] + '18',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '60',
  },
  tabLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  tabLabelActive: {
    color: theme.colors.primary[300],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  tabDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.dark.textFaint,
  },
  tabDotActive: {
    backgroundColor: theme.colors.primary[400],
  },
  gridContainer: {
    gap: theme.spacing.sm,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: CARD_MIN_WIDTH,
    flex: 1,
    ...theme.shadows.card,
  },
  cardExpanded: {
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '50',
  },
  cardDimmed: {
    opacity: 0.5,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconWrapActive: {
    backgroundColor: theme.colors.primary[500] + '25',
  },
  cardLabel: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  cardLabelActive: {
    color: theme.colors.primary[300],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  expandedPanel: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.elevated,
  },
});
