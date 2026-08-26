import * as React from 'react';
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop, LinearGradient } from 'react-native-svg';

type BabyIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function BabyIcon({ size = 24, color = '#1e3a5f', strokeWidth = 2 }: BabyIconProps) {
  const s = size;
  const sw = strokeWidth;

  const skinLight = '#FFE4D0';
  const skinBase = '#F4C4A8';
  const skinShadow = '#E0A884';
  const cheekColor = '#FF9999';
  const hairColor = '#8B5E3C';
  const hairHighlight = '#B07A4F';
  const outfitBase = color;
  const outfitLight = '#FFFFFF';
  const outfitShadow = 'rgba(0,0,0,0.15)';

  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      <Defs>
        <RadialGradient id="babyHeadGrad" cx="40%" cy="35%" r="65%">
          <Stop offset="0%" stopColor={skinLight} />
          <Stop offset="60%" stopColor={skinBase} />
          <Stop offset="100%" stopColor={skinShadow} />
        </RadialGradient>
        <RadialGradient id="babyBodyGrad" cx="50%" cy="30%" r="70%">
          <Stop offset="0%" stopColor={outfitLight} />
          <Stop offset="50%" stopColor={outfitBase} />
          <Stop offset="100%" stopColor={outfitShadow} />
        </RadialGradient>
        <LinearGradient id="babyHairGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={hairHighlight} />
          <Stop offset="100%" stopColor={hairColor} />
        </LinearGradient>
        <RadialGradient id="babyCheekGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={cheekColor} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={cheekColor} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Body lying down — rounded onesie shape with 3D gradient */}
      <Ellipse cx="24" cy="32" rx="15" ry="7.5" fill="url(#babyBodyGrad)" />
      <Ellipse cx="24" cy="30.5" rx="15" ry="7.5" stroke={color} strokeWidth={sw * 0.5} fill="none" opacity="0.4" />

      {/* Arms waving up — rounded with slight gradient feel */}
      <Path
        d="M11 28 Q7 22 10 16"
        stroke={skinBase}
        strokeWidth={sw * 1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M11 28 Q7 22 10 16"
        stroke={skinShadow}
        strokeWidth={sw * 0.5}
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />
      <Path
        d="M37 28 Q41 22 38 16"
        stroke={skinBase}
        strokeWidth={sw * 1.6}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M37 28 Q41 22 38 16"
        stroke={skinShadow}
        strokeWidth={sw * 0.5}
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      {/* Tiny hands */}
      <Circle cx="10" cy="15.5" r="2.2" fill={skinBase} stroke={skinShadow} strokeWidth={sw * 0.3} />
      <Circle cx="38" cy="15.5" r="2.2" fill={skinBase} stroke={skinShadow} strokeWidth={sw * 0.3} />

      {/* Legs kicking out — rounded */}
      <Path
        d="M17 36 Q14 41 12 45"
        stroke={skinBase}
        strokeWidth={sw * 1.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M31 36 Q34 41 36 45"
        stroke={skinBase}
        strokeWidth={sw * 1.5}
        strokeLinecap="round"
        fill="none"
      />
      {/* Tiny feet */}
      <Ellipse cx="11.5" cy="45" rx="2.5" ry="1.8" fill={skinShadow} />
      <Ellipse cx="36.5" cy="45" rx="2.5" ry="1.8" fill={skinShadow} />

      {/* Head — 3D sphere with radial gradient */}
      <Circle cx="24" cy="14" r="8" fill="url(#babyHeadGrad)" stroke={skinShadow} strokeWidth={sw * 0.3} />

      {/* Hair — soft rounded tuft on top */}
      <Path
        d="M16 11 Q18 5 24 5.5 Q30 5 32 11 Q28 8 24 8.5 Q20 8 16 11 Z"
        fill="url(#babyHairGrad)"
      />

      {/* Cheeks — soft blush */}
      <Circle cx="18.5" cy="16" r="2.5" fill="url(#babyCheekGrad)" />
      <Circle cx="29.5" cy="16" r="2.5" fill="url(#babyCheekGrad)" />

      {/* Eyes — simple dots with subtle highlight */}
      <Circle cx="21" cy="13.5" r="1.1" fill="#2D2D2D" />
      <Circle cx="27" cy="13.5" r="1.1" fill="#2D2D2D" />
      <Circle cx="21.3" cy="13.2" r="0.35" fill="#FFFFFF" />
      <Circle cx="27.3" cy="13.2" r="0.35" fill="#FFFFFF" />

      {/* Happy smile */}
      <Path
        d="M21 16 Q24 19 27 16"
        stroke="#C47070"
        strokeWidth={sw * 0.6}
        strokeLinecap="round"
        fill="none"
      />

      {/* Subtle head shadow on body */}
      <Ellipse cx="24" cy="26" rx="7" ry="2" fill="rgba(0,0,0,0.12)" />
    </Svg>
  );
}
