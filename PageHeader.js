import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BLUE, INK } from './theme';

// One themed header banner per page, built from pageThemes.js. Keeps
// the same title/subtitle stack every screen already has - this only
// replaces the plain <Text style={shared.h1}> line - but gives each
// page its own accent color, a badge shaped around something concrete
// from that page's own world (a ticket stub, a recipe-box tab, a wax
// seal, a dojo stamp, an almanac's day-dots), and an underline rule in
// the page's accent instead of the app-wide flat gold everywhere.
//
// Deliberately restrained: the badge is the one bold/decorative thing
// per page. Title typography, spacing, and everything below stays
// exactly what the shared theme already renders.
export default function PageHeader({ theme, title, icon }) {
  return (
    <View style={styles.row}>
      <Badge theme={theme} icon={icon || theme.icon} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text
          style={[
            styles.title,
            { color: theme.accent, fontFamily: theme.fontFamily },
          ]}
        >
          {title}
        </Text>
        <View style={[styles.rule, { backgroundColor: theme.accent }]} />
      </View>
    </View>
  );
}

function Badge({ theme, icon }) {
  switch (theme.motif) {
    case 'ticket':
      return (
        <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
          <View style={[styles.ticketNotch, styles.ticketNotchTop, { backgroundColor: BLUE, borderColor: theme.accent }]} />
          <View style={[styles.ticketNotch, styles.ticketNotchBottom, { backgroundColor: BLUE, borderColor: theme.accent }]} />
          <View style={[styles.ticketDash, { borderColor: theme.accent }]} />
          <Text style={styles.badgeIcon}>{icon}</Text>
        </View>
      );
    case 'recipeCard':
      return (
        <View style={{ alignItems: 'flex-start' }}>
          <View style={[styles.recipeTab, { backgroundColor: theme.accent }]} />
          <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent, marginTop: -4 }]}>
            <Text style={styles.badgeIcon}>{icon}</Text>
          </View>
        </View>
      );
    case 'scroll':
      return (
        <View style={[styles.badgeCircle, { borderColor: theme.accentDeep }]}>
          <View style={[styles.badgeCircleInner, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={styles.badgeIcon}>{icon}</Text>
          </View>
        </View>
      );
    case 'stamp':
      return (
        <View style={[styles.badgeCircle, styles.badgeStamp, { borderColor: theme.accent }]}>
          <Text style={styles.badgeIcon}>{icon}</Text>
        </View>
      );
    case 'almanac':
      return (
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
            <Text style={styles.badgeIcon}>{icon}</Text>
          </View>
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === 1 ? theme.accent : theme.accentSoft },
                ]}
              />
            ))}
          </View>
        </View>
      );
    default:
      return (
        <View style={[styles.badge, { backgroundColor: theme.accentSoft, borderColor: theme.accent }]}>
          <Text style={styles.badgeIcon}>{icon}</Text>
        </View>
      );
  }
}

const BADGE_SIZE = 46;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  title: { fontSize: 27, fontWeight: '800', letterSpacing: 0.5 },
  rule: { height: 3, borderRadius: 2, width: 46, marginTop: 6, opacity: 0.85 },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badgeIcon: { fontSize: 22 },

  // Ticket (Tracker): a dashed perforation line down the middle with a
  // small "bite" cut out of the top and bottom edge, like a torn stub.
  ticketDash: {
    position: 'absolute',
    left: '50%',
    top: 4,
    bottom: 4,
    borderLeftWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.55,
  },
  ticketNotch: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    left: '50%',
    marginLeft: -5,
  },
  ticketNotchTop: { top: -6 },
  ticketNotchBottom: { bottom: -6 },

  // Recipe card (Recipes): a little protruding tab, like a divider card
  // in a recipe box.
  recipeTab: {
    width: 22,
    height: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    marginLeft: 6,
  },

  // Wax-seal ring (Roadmaps) and dojo stamp ring (Habits) share the same
  // circular base, styled differently below.
  badgeCircle: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeCircleInner: {
    width: BADGE_SIZE - 12,
    height: BADGE_SIZE - 12,
    borderRadius: (BADGE_SIZE - 12) / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeStamp: {
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },

  // Almanac (Calendar): a small row of day/moon-phase dots under the
  // badge, with the current one lit up.
  dotsRow: { flexDirection: 'row', marginTop: 5, gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
