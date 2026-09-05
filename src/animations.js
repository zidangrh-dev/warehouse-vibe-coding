import { useEffect, useRef } from 'react';
import { Pressable, Animated, Modal as RNModal, View, Platform } from 'react-native';

// Scale-down on press feedback — menggantikan TouchableOpacity.
export function PressableOpacity({ children, style, onPress, disabled, activeOpacity = 0.97, ...props }) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, { toValue: activeOpacity, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };
  const onPressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
  };

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} disabled={disabled} {...props}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Modal dengan slide-up animation + backdrop fade.
export function AnimatedModal({ visible, onClose, children, style, contentStyle }) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      translateY.setValue(300);
      opacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <RNModal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.55)', justifyContent: 'flex-end', padding: 16 }}>
        <Animated.View style={[{ backgroundColor: '#fff', borderRadius: 16, padding: 22, maxHeight: '90%', transform: [{ translateY }], opacity }, contentStyle]}>
          {children}
        </Animated.View>
      </View>
    </RNModal>
  );
}

// Fade + slide content transition untuk tab switching.
export function FadeInView({ children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// Animated number counter — untuk stat cards.
export function AnimatedNumber({ value, style }) {
  const anim = useRef(new Animated.Value(0)).current;
  const displayRef = useRef(null);

  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 600, useNativeDriver: false }).start();
    const listener = anim.addListener(({ value: v }) => {
      if (displayRef.current) displayRef.current.textContent = String(Math.round(v));
    });
    return () => anim.removeListener(listener);
  }, [value]);

  if (Platform.OS === 'web') {
    return <span ref={displayRef} style={style}>{value}</span>;
  }
  // Native: fallback ke value langsung
  return <Animated.Text style={style}>{anim.interpolate({ inputRange: [0, Math.max(value, 1)], outputRange: [0, value] })}</Animated.Text>;
}
