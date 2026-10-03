import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { GOLD, INK, DIM, CARD, BORDER, ROSE } from './theme';

// Wraps a section of the tree and catches render/lifecycle errors in it.
// Without this, a single bad value in one screen's data (an undefined
// field a .map()/.toLowerCase() etc. wasn't expecting) takes down the
// whole app on a release build with no red-box and no clue what broke -
// it just closes. This turns that into a readable screen with the
// actual error and a way to get back to a working tab instead of having
// to reinstall or roll back data blind.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
  }

  reset = () => {
    this.setState({ error: null, info: null });
    if (this.props.onReset) this.props.onReset();
  };

  render() {
    if (this.state.error) {
      const { error, info } = this.state;
      return (
        <View style={styles.wrap}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.title}>Something crashed</Text>
            <Text style={styles.subtitle}>
              {this.props.label ? `In: ${this.props.label}` : 'This screen hit an error.'}
            </Text>
            <View style={styles.box}>
              <Text style={styles.errorText}>{String(error && error.message ? error.message : error)}</Text>
            </View>
            {error && error.stack ? (
              <View style={styles.box}>
                <Text style={styles.stackText}>{String(error.stack)}</Text>
              </View>
            ) : null}
            {info && info.componentStack ? (
              <View style={styles.box}>
                <Text style={styles.stackText}>{String(info.componentStack)}</Text>
              </View>
            ) : null}
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={this.reset}>
            <Text style={styles.btnText}>Back to app</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0c0a0a' },
  scroll: { padding: 18, paddingBottom: 30 },
  title: { color: ROSE, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: DIM, fontSize: 13, marginBottom: 14 },
  box: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: INK, fontSize: 14, fontWeight: '700' },
  stackText: { color: DIM, fontSize: 11, lineHeight: 15 },
  btn: {
    margin: 16,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: { color: '#1a1512', fontSize: 15, fontWeight: '800' },
});
