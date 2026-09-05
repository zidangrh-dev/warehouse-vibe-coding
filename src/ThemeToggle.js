import { TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from './theme';
import Icon from './Icon';

// Tombol on/off dark mode — dipakai di header tab & layar login.
export function ThemeToggle({ style }) {
  const { colors, isDark, toggle } = useTheme();
  return (
    <TouchableOpacity
      style={[s.btn, style]}
      onPress={toggle}
      accessibilityLabel={isDark ? 'Mode terang' : 'Mode gelap'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={17} color={colors.primary} strokeWidth={2.2} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});