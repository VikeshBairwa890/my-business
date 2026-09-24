import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';

export type IconSource = 'ion' | 'material';

export interface AppIconProps {
  name: string;
  size?: number;
  color?: string;
  source?: IconSource;
}

export function AppIcon({
  name,
  size = 22,
  color = Colors.textPrimary,
  source = 'ion',
}: AppIconProps) {
  if (source === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}
