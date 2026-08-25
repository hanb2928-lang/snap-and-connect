import { useState, useCallback, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { LazySection } from '@/components/LazySection';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type FeatureTile = {
  key: string;
  label: string;
  icon: ReactNode;
  category: string;
  render: () => ReactNode;
};

export type FeatureCategory = {
  key: string;
  label: string;
  tiles: FeatureTile[];
};

type Props = {
  categories: FeatureCategory[];
};

export function FeatureTileGrid({ categories }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const toggle = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  return (
    <View style={styles.wrap}>
      {categories.map((category, ci) => {
        const expandedTile = category.tiles.find((t) => t.key === expandedKey);
        return (
          <LazySection key={category.key} delayMs={ci * 60}>
            <View style={styles.categoryWrap}>
              <Text style={styles.categoryLabel}>{category.label}</Text>
              <View style={styles.tileRow}>
                {category.tiles.map((tile) => (
                  <TouchableOpacity
                    key={tile.key}
                    style={[
                      styles.tile,
                      expandedTile && expandedKey !== tile.key && styles.tileDimmed,
                    ]}
                    onPress={() => toggle(tile.key)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.tileIconWrap,
                        expandedKey === tile.key && styles.tileIconWrapActive,
                      ]}
                    >
                      {tile.icon}
                    </View>
                    <Text
                      style={[
                        styles.tileLabel,
                        expandedKey === tile.key && styles.tileLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {tile.label}
                    </Text>
                    {expandedKey === tile.key ? (
                      <ChevronUp size={12} color={theme.colors.primary[300]} strokeWidth={2.5} />
                    ) : (
                      <ChevronDown size={12} color={theme.colors.dark.textFaint} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {expandedTile && (
                <View style={styles.expandedPanel}>
                  {category.tiles
                    .filter((t) => t.key === expandedKey)
                    .map((t) => (
                      <View key={t.key}>{t.render()}</View>
                    ))}
                </View>
              )}
            </View>
          </LazySection>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: theme.spacing.lg,
  },
  categoryWrap: {
    marginTop: theme.spacing.xl,
  },
  categoryLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: theme.spacing.sm,
    paddingLeft: 2,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tile: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    ...theme.shadows.card,
  },
  tileDimmed: {
    opacity: 0.55,
  },
  tileIconWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileIconWrapActive: {
    backgroundColor: theme.colors.primary[500] + '30',
  },
  tileLabel: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  tileLabelActive: {
    color: theme.colors.primary[300],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  expandedPanel: {
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
});
