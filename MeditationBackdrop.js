import React, { useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Shared immersive scene for every meditation style, swapping in for the
// old single hardcoded beach video. The old version was "too basic" —
// one photo-ish layer pulsing in sync with breathing and nothing else —
// so this adds actual depth instead of just a better color: a multi-stop
// gradient (never flat), a soft ambient glow, and a field of particles
// drifting slowly and independently of each other (each on its own timer
// with its own size/speed/position, not one shape repeated in lockstep),
// so the scene feels alive even before a breath is taken. `pulse` is
// optional — when a session has a breathing rhythm to sync to, the glow
// gently swells with it; body scan (no breath pacing) just omits it and
// the ambient layer alone keeps the scene from feeling static.
const PARTICLE_COUNT = 14;
const AMBIENT_PARTICLES = Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
  // Deterministic "random" spread (no two particles identical) without
  // reaching for Math.random() in render — stable across re-renders.
  const seed = (i * 53) % 97;
  return {
    left: 4 + ((i * 29) % 92),
    size: 3 + (seed % 5),
    duration: 9000 + (seed % 7) * 1400,
    delay: (seed % 11) * 300,
    maxOpacity: 0.35 + ((seed % 5) / 5) * 0.4,
    drift: 50 + (seed % 6) * 14,
  };
});

export default function MeditationBackdrop({ theme, pulse, children }) {
  const animsRef = useRef(AMBIENT_PARTICLES.map(() => new Animated.Value(0)));

  useEffect(() => {
    const loops = animsRef.current.map((anim, i) => {
      const p = AMBIENT_PARTICLES[i];
      anim.setValue(0);
      return Animated.loop(
        Animated.timing(anim, {
          toValue: 1,
          duration: p.duration,
          delay: p.delay,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
    });
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  const glowScale = pulse
    ? pulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.92, 1.18] })
    : 1;
  const glowOpacity = pulse
    ? pulse.interpolate({ inputRange: [1, 1.5], outputRange: [0.22, 0.48] })
    : 0.3;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={theme.gradientColors}
        locations={theme.gradientLocations}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { backgroundColor: theme.glowColor, opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      {AMBIENT_PARTICLES.map((p, i) => {
        const anim = animsRef.current[i];
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -p.drift] });
        const opacity = anim.interpolate({
          inputRange: [0, 0.12, 0.85, 1],
          outputRange: [0, p.maxOpacity, p.maxOpacity, 0],
        });
        return (
          <Animated.View
            key={i}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              bottom: '12%',
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: theme.particleColor,
              opacity,
              transform: [{ translateY }],
            }}
          />
        );
      })}

      <LinearGradient
        colors={['transparent', theme.groundColor]}
        locations={[0, 1]}
        style={styles.groundStrip}
        pointerEvents="none"
      />

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    top: '28%',
    left: '50%',
    width: 260,
    height: 260,
    borderRadius: 130,
    marginLeft: -130,
    marginTop: -130,
  },
  groundStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '18%',
  },
});
