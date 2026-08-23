import * as React from 'react';
import Svg, { Path, Circle, Ellipse } from 'react-native-svg';

type BabyIconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function BabyIcon({ size = 24, color = '#1e3a5f', strokeWidth = 2 }: BabyIconProps) {
  const s = size;
  const sw = strokeWidth;

  return (
    <Svg width={s} height={s} viewBox="0 0 48 48" fill="none">
      {/* Head */}
      <Circle cx="24" cy="14" r="7" stroke={color} strokeWidth={sw} fill="none" />
      {/* Happy smile */}
      <Path
        d="M21 15.5 Q24 18 27 15.5"
        stroke={color}
        strokeWidth={sw * 0.7}
        strokeLinecap="round"
        fill="none"
      />
      {/* Eyes */}
      <Circle cx="21.5" cy="13" r="0.9" fill={color} />
      <Circle cx="26.5" cy="13" r="0.9" fill={color} />
      {/* Body lying down */}
      <Ellipse cx="24" cy="30" rx="14" ry="6" stroke={color} strokeWidth={sw} fill="none" />
      {/* Arms waving up */}
      <Path
        d="M12 27 Q9 22 11 17"
        stroke={color}
        strokeWidth={sw * 0.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M36 27 Q39 22 37 17"
        stroke={color}
        strokeWidth={sw * 0.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* Legs kicking */}
      <Path
        d="M18 35 Q15 40 13 44"
        stroke={color}
        strokeWidth={sw * 0.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M30 35 Q33 40 35 44"
        stroke={color}
        strokeWidth={sw * 0.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}
