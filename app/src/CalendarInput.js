import React from 'react';
import { Platform, TextInput } from 'react-native';
import { useTheme } from './theme';

export function CalendarInput({ value, onChange }) {
  const { colors } = useTheme();
  if (Platform.OS === 'web') {
    return React.createElement('input', {
      type: 'date',
      value: value || '',
      onChange: (e) => onChange(e.target.value),
      style: {
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: colors.neutralBorder,
        borderRadius: '8px',
        padding: '5px 10px',
        fontSize: '13px',
        fontWeight: '600',
        color: colors.ink,
        backgroundColor: colors.surface,
        textAlign: 'center',
        outline: 'none',
        fontFamily: 'inherit',
        cursor: 'pointer',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      },
    });
  }
  return (
    <TextInput
      style={{
        borderWidth: 1,
        borderColor: colors.neutralBorder,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        fontSize: 13,
        fontWeight: '600',
        color: colors.ink,
        backgroundColor: colors.surface,
        textAlign: 'center',
        width: 120,
      }}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
    />
  );
}
