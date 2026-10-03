import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  StyleSheet,
  Linking,
  ScrollView,
  Modal,
  useWindowDimensions,
} from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';
import { LinearGradient } from 'expo-linear-gradient';
import { INK, DIM, CARD, BORDER } from './theme';
import { releasedEpisodeCount } from './trackerMath';

function formatReleaseDate(val) {
  if (!val) return '';
  const d = new Date(val + 'T00:00:00');
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host === 'youtu.be') return u.pathname.slice(1);
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2];
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2];
    }
  } catch (e) {}
  return null;
}

// A 2-up-per-row poster card that flips on tap to show status, release
// date, progress, and (when there's a trailer link) an inline player —
// on the back. Every card keeps the same compact grid size regardless
// of whether it has a trailer, so there's no longer a separate
// full-width "video card" layout to choose between: the poster (or the
// trailer's own thumbnail, when there's no uploaded poster) is always
// the front, and the trailer itself plays inline on the back, next to
// the rest of the info, instead of jumping out to YouTube.
export default function TrackerCard({
  item,
  categories,
  color,
  label,
  isGame,
  isManga,
  isEpisodic,
  isMovie,
  onEdit,
  onManageProgress,
  onAdjustEpisode,
  onAdjustGamePercent,
  onToggleWatched,
  onArchive,
  etaLabel,
}) {
  const [flipped, setFlipped] = useState(false);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  // Percentage width + aspectRatio doesn't reliably resolve a height
  // inside a flexWrap row (it can come out as 0 on some RN/Yoga
  // builds, which is why cards were disappearing entirely) - so the
  // box is sized with real pixel numbers instead, computed from the
  // window width. GRID_H_PADDING/CARD_GAP mirror TrackerScreen's own
  // container padding (16 each side) and the gap its grid's
  // justifyContent:'space-between' leaves between two columns (12).
  const { width: winWidth } = useWindowDimensions();
  const GRID_H_PADDING = 16;
  const CARD_GAP = 12;
  const cardWidth = (winWidth - GRID_H_PADDING * 2 - CARD_GAP) / 2;
  // Trailer modal player - sized explicitly (react-native-youtube-iframe
  // wants a real pixel height, not a flex/aspectRatio box) to fill the
  // modal's full width at a 16:9 ratio.
  const playerHeight = Math.round(winWidth * (9 / 16));
  // maxresdefault.jpg is the true 1280x720 thumbnail with no baked-in
  // letterboxing - but it doesn't exist for every video, so fall back
  // to the always-available hqdefault.jpg if it 404s.
  const [useMaxRes, setUseMaxRes] = useState(true);

  // Poster art comes in all kinds of aspect ratios - forcing every one
  // into the same fixed box is what was cropping (with cover) or
  // letterboxing (with contain) images that didn't match it. Reading
  // the image's real width/height and using THAT as the card's aspect
  // ratio means the box always matches the picture exactly, so nothing
  // gets cut off or padded with black bars. Falls back to the old
  // movie-poster ratio (2:3-ish) until the real size loads, or if it
  // fails to load at all.
  const FALLBACK_RATIO = 3 / 5.6;
  const [posterRatio, setPosterRatio] = useState(FALLBACK_RATIO);
  useEffect(() => {
    if (!item.image) {
      setPosterRatio(FALLBACK_RATIO);
      return;
    }
    let cancelled = false;
    Image.getSize(
      item.image,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setPosterRatio(w / h);
      },
      () => {
        // Couldn't read real dimensions (bad url, network, etc.) -
        // just keep the fallback ratio rather than leaving it broken.
        if (!cancelled) setPosterRatio(FALLBACK_RATIO);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [item.image]);

  function flip() {
    Animated.spring(anim, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setFlipped(!flipped);
  }

  const ratio = item.image ? posterRatio : FALLBACK_RATIO;
  const cardHeight = cardWidth / ratio;

  const frontRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });

  const epTotal = Number(item.epTotal) || 0;
  const epCurrent = Number(item.epCurrent) || 0;
  const epPct = epTotal > 0 ? Math.min(100, Math.round((epCurrent / epTotal) * 100)) : 0;
  const progressWord = isManga ? 'Ch' : 'Ep';
  const ytId = item.mediaUrl ? getYouTubeId(item.mediaUrl) : null;
  // Three different hand-rolled WebView embeds (bare iframe, then with a
  // proper https origin, then the real IFrame Player API script) all hit
  // the identical "Error 152" on two videos YouTube's own oEmbed API
  // confirms ARE embeddable - on a phone with no VPN/ad-blocker/DNS
  // filtering to blame either. That rules out our HTML and the video
  // both; what's left is Android WebView's YouTube playback being
  // generally unreliable when hand-rolled. react-native-youtube-iframe
  // is the actively-maintained library most working RN apps use for
  // exactly this - it's still a WebView under the hood (no native
  // rebuild needed, react-native-webview is already linked) but it
  // carries a long list of Android-specific workarounds for this exact
  // class of failure that a hand-rolled page doesn't have.
  const comingSoon = item.status === 'coming_soon';
  const wantToBuy = !!item.wantToBuy && !comingSoon;
  const finished = isMovie ? !!item.watched : epTotal > 0 && epCurrent >= epTotal;
  const released = isEpisodic && !isManga && epTotal > 0 ? releasedEpisodeCount(item.airDate, epTotal) : null;
  const stillAiring = released != null && released < epTotal;

  return (
    <View style={[styles.cardSlot, { width: cardWidth, height: cardHeight }]}>
      {/* FRONT - flipping is the only thing this face does, so the whole
          poster is safely one big tap target with nothing nested inside it. */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={flip}
        onLongPress={onEdit}
        delayLongPress={400}
        style={styles.touchArea}
        pointerEvents={flipped ? 'none' : 'auto'}
      >
        <Animated.View style={[styles.face, { transform: [{ rotateY: frontRotate }] }]}>
          <View style={styles.poster}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.posterImg} resizeMode="contain" />
            ) : ytId ? (
              <Image
                source={{
                  uri: `https://img.youtube.com/vi/${ytId}/${useMaxRes ? 'maxresdefault' : 'hqdefault'}.jpg`,
                }}
                style={styles.posterImg}
                resizeMode="cover"
                onError={() => setUseMaxRes(false)}
              />
            ) : (
              <View style={[styles.posterImg, styles.posterPlaceholder, { backgroundColor: color }]}>
                <Text style={styles.posterLetter}>{(item.title || '?').charAt(0).toUpperCase()}</Text>
              </View>
            )}

            {ytId ? (
              <View style={styles.playBadge}>
                <Text style={styles.playBadgeText}>▶</Text>
              </View>
            ) : null}

            {comingSoon ? (
              <View style={[styles.ribbon, { backgroundColor: '#bc9440' }]}>
                <Text style={styles.ribbonText}>SOON</Text>
              </View>
            ) : wantToBuy ? (
              <View style={[styles.ribbon, { backgroundColor: '#6b8fc9' }]}>
                <Text style={styles.ribbonText}>WISHLIST</Text>
              </View>
            ) : finished ? (
              <View style={[styles.ribbon, { backgroundColor: '#3f8f82' }]}>
                <Text style={styles.ribbonText}>DONE</Text>
              </View>
            ) : stillAiring ? (
              <View style={[styles.ribbon, { backgroundColor: '#9a5c8f' }]}>
                <Text style={styles.ribbonText}>AIRING</Text>
              </View>
            ) : null}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={styles.posterScrim}
            >
              <Text style={styles.posterTitle} numberOfLines={2}>
                {item.title}
              </Text>
              {!comingSoon ? (
                <View style={styles.frontStatusRow}>
                  {finished ? (
                    <Text style={styles.frontStatusText}>✓ Finished</Text>
                  ) : isMovie ? (
                    <Text style={styles.frontStatusText}>Not watched yet</Text>
                  ) : isGame ? (
                    <>
                      <View style={styles.frontBarTrack}>
                        <View
                          style={[
                            styles.frontBarFill,
                            { width: `${item.gamePercent || 0}%`, backgroundColor: color },
                          ]}
                        />
                      </View>
                      <Text style={styles.frontStatusText}>{item.gamePercent || 0}%</Text>
                    </>
                  ) : epTotal > 0 ? (
                    <>
                      <View style={styles.frontBarTrack}>
                        <View style={[styles.frontBarFill, { width: `${epPct}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={styles.frontStatusText}>
                        {progressWord} {epCurrent}/{epTotal}
                      </Text>
                    </>
                  ) : epCurrent > 0 ? (
                    <Text style={styles.frontStatusText}>
                      {progressWord} {epCurrent} so far
                    </Text>
                  ) : (
                    <Text style={styles.frontStatusText}>Not started</Text>
                  )}
                </View>
              ) : null}
            </LinearGradient>
          </View>
        </Animated.View>
      </TouchableOpacity>

      {/* BACK */}
      <Animated.View
        pointerEvents={flipped ? 'auto' : 'none'}
        style={[styles.face, styles.faceBack, { transform: [{ rotateY: backRotate }] }]}
      >
        <View style={[styles.backAccent, { backgroundColor: color }]} />

        {/* Tapping THIS header is the only way to flip back - it's a
            dedicated zone, not the whole face, so it can never swallow a
            tap meant for a stepper or action button sitting below it. */}
        <TouchableOpacity style={styles.backHeader} activeOpacity={0.7} onPress={flip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.backTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={[styles.labelPill, { backgroundColor: color + '2A', borderColor: color + '55' }]}>
              <Text style={[styles.labelPillText, { color }]}>{label}</Text>
            </View>
          </View>
          <Text style={styles.flipHint}>↺</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <ScrollView
          style={styles.backContent}
          contentContainerStyle={styles.backContentInner}
          showsVerticalScrollIndicator={false}
        >
          {ytId ? (
            <TouchableOpacity
              style={[styles.watchTrailerBtn, { borderColor: color }]}
              onPress={() => setTrailerOpen(true)}
            >
              <View style={[styles.watchTrailerIcon, { backgroundColor: color }]}>
                <Text style={styles.watchTrailerIconText}>▶</Text>
              </View>
              <Text style={[styles.watchTrailerBtnText, { color }]}>Watch Trailer</Text>
            </TouchableOpacity>
          ) : null}

          {comingSoon ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>📅</Text>
              <Text style={[styles.statusText, { color: '#d9a441' }]}>Coming Soon</Text>
              <Text style={styles.detailText}>
                {item.releaseDate ? formatReleaseDate(item.releaseDate) : 'No date set yet'}
              </Text>
            </View>
          ) : wantToBuy ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>🛒</Text>
              <Text style={[styles.statusText, { color: '#6b8fc9' }]}>Want to Buy</Text>
              <Text style={styles.detailText}>Released — just don't own it yet</Text>
            </View>
          ) : isMovie ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>{finished ? '✓' : '🎬'}</Text>
              <Text style={[styles.statusText, finished && { color: '#4fb894' }]}>
                {finished ? 'Watched' : 'Not watched yet'}
              </Text>
              <TouchableOpacity
                style={[styles.watchedToggle, { borderColor: color }, finished && { backgroundColor: color + '22' }]}
                onPress={() => onToggleWatched && onToggleWatched(item)}
              >
                <Text style={[styles.watchedToggleText, { color }]}>
                  {finished ? '↺ Mark as Not Watched' : '✓ Mark as Watched'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : finished ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>✓</Text>
              <Text style={[styles.statusText, { color: '#4fb894' }]}>Finished</Text>
              <Text style={styles.detailText}>
                {progressWord} {epCurrent}/{epTotal}
              </Text>
            </View>
          ) : isGame ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>🎮</Text>
              <Text style={styles.statusText}>{item.gamePercent || 0}% complete</Text>
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={[color + 'AA', color]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.barFill, { width: `${item.gamePercent || 0}%` }]}
                />
              </View>
              {etaLabel ? <Text style={styles.etaText}>⚡ {etaLabel}</Text> : null}
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderColor: color }]}
                  onPress={() => onAdjustGamePercent(item, -1)}
                >
                  <Text style={[styles.stepBtnText, { color }]}>−1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderColor: color }]}
                  onPress={() => onAdjustGamePercent(item, 1)}
                >
                  <Text style={[styles.stepBtnText, { color }]}>+1</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : epTotal > 0 ? (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>{isManga ? '📖' : '🎬'}</Text>
              <Text style={styles.statusText}>
                {progressWord} {epCurrent} of {epTotal}
              </Text>
              <View style={styles.barTrack}>
                <LinearGradient
                  colors={[color + 'AA', color]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.barFill, { width: `${epPct}%` }]}
                />
              </View>
              <Text style={styles.detailText}>{epPct}% {isManga ? 'read' : 'watched'}</Text>
              {released != null ? (
                <Text style={[styles.detailText, stillAiring ? styles.airingText : styles.airedDoneText]}>
                  📡 {released}/{epTotal} released
                  {stillAiring ? ' so far' : ' — fully aired'}
                </Text>
              ) : null}
              {etaLabel ? <Text style={styles.etaText}>⚡ {etaLabel}</Text> : null}
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderColor: color }]}
                  onPress={() => onAdjustEpisode(item, -1)}
                >
                  <Text style={[styles.stepBtnText, { color }]}>−1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderColor: color }]}
                  onPress={() => onAdjustEpisode(item, 1)}
                >
                  <Text style={[styles.stepBtnText, { color }]}>+1</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.statusBlock}>
              <Text style={styles.statusIcon}>📡</Text>
              <Text style={styles.statusText}>Ongoing</Text>
              <Text style={styles.detailText}>
                {epCurrent > 0 ? `${progressWord} ${epCurrent} so far` : 'New weekly releases'}
              </Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderColor: color }]}
                  onPress={() => onAdjustEpisode(item, -1)}
                >
                  <Text style={[styles.stepBtnText, { color }]}>−1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.stepBtn, { borderColor: color }]}
                  onPress={() => onAdjustEpisode(item, 1)}
                >
                  <Text style={[styles.stepBtnText, { color }]}>+1</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {item.notes ? (
            <View style={styles.notesBlock}>
              <Text style={styles.notesLabel}>NOTES</Text>
              <Text style={styles.notesText} numberOfLines={4}>
                {item.notes}
              </Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.backActions}>
          {finished && onArchive ? (
            <TouchableOpacity style={[styles.actionChip, styles.archiveChip]} onPress={() => onArchive(item)}>
              <Text style={styles.archiveChipText}>🏁 Move to Finished</Text>
            </TouchableOpacity>
          ) : null}
          {(isGame || isEpisodic || isManga) && !comingSoon ? (
            <TouchableOpacity style={styles.actionChip} onPress={onManageProgress}>
              <Text style={styles.actionChipText}>Manage</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.actionChip} onPress={onEdit}>
            <Text style={styles.actionChipText}>✎ Edit</Text>
          </TouchableOpacity>
          {item.mediaUrl ? (
            <TouchableOpacity
              style={styles.actionChip}
              onPress={() => Linking.openURL(item.mediaUrl)}
            >
              <Text style={styles.actionChipText}>{ytId ? 'Open in YouTube ↗' : '▶ Watch'}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </Animated.View>

      {/* Trailer plays here, full-screen, instead of cramped inside the
          half-width flipped card - tapping "Watch Trailer" opens this
          instead of leaving the app. */}
      <Modal
        visible={trailerOpen}
        animationType="slide"
        onRequestClose={() => setTrailerOpen(false)}
        statusBarTranslucent
      >
        <View style={styles.trailerModal}>
          <View style={[styles.trailerPlayerWrap, { height: playerHeight }]}>
            {ytId ? (
              <YoutubePlayer
                height={playerHeight}
                width={winWidth}
                videoId={ytId}
                play={trailerOpen}
                webViewProps={{ allowsInlineMediaPlayback: true, mediaPlaybackRequiresUserAction: false }}
              />
            ) : null}
            <TouchableOpacity style={styles.trailerCloseBtn} onPress={() => setTrailerOpen(false)}>
              <Text style={styles.trailerCloseBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.trailerInfoInner}>
            <Text style={styles.trailerTitle}>{item.title}</Text>
            <View
              style={[
                styles.labelPill,
                { backgroundColor: color + '2A', borderColor: color + '55', alignSelf: 'flex-start', marginTop: 8 },
              ]}
            >
              <Text style={[styles.labelPillText, { color }]}>{label}</Text>
            </View>
            {item.notes ? (
              <View style={[styles.notesBlock, { marginTop: 16 }]}>
                <Text style={styles.notesLabel}>NOTES</Text>
                <Text style={styles.notesText}>{item.notes}</Text>
              </View>
            ) : null}
            {item.mediaUrl ? (
              <TouchableOpacity
                style={styles.trailerExternalBtn}
                onPress={() => Linking.openURL(item.mediaUrl)}
              >
                <Text style={styles.trailerExternalBtnText}>
                  Having trouble playing it here? Open in YouTube ↗
                </Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  cardSlot: { marginBottom: 14 },
  touchArea: { flex: 1, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  face: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backfaceVisibility: 'hidden',
    borderRadius: 14,
    overflow: 'hidden',
  },
  poster: { flex: 1, backgroundColor: CARD },
  posterImg: { width: '100%', height: '100%', backgroundColor: CARD },
  posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  posterLetter: { color: '#fff', fontSize: 40, fontWeight: '800' },
  posterScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 30,
    paddingHorizontal: 10, paddingBottom: 10,
  },
  posterTitle: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 17 },
  frontStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5, gap: 6 },
  frontBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  frontBarFill: { height: '100%', borderRadius: 2 },
  frontStatusText: { color: '#fff', fontSize: 10, fontWeight: '800', opacity: 0.9 },
  playBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  playBadgeText: { color: '#fff', fontSize: 11, marginLeft: 1 },
  ribbon: {
    position: 'absolute', top: 10, right: -28, paddingVertical: 3, width: 100,
    alignItems: 'center', transform: [{ rotate: '40deg' }],
  },
  ribbonText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  faceBack: {
    backgroundColor: '#161d26', flexDirection: 'column',
  },
  backAccent: { height: 4, width: '100%' },
  backHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 10 },
  flipHint: { color: DIM, fontSize: 16, marginLeft: 8 },
  backContent: { flex: 1 },
  backContentInner: { paddingHorizontal: 12, paddingBottom: 12, flexGrow: 1 },
  backTitle: { color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 19 },
  labelPill: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 9, paddingVertical: 3, marginTop: 6,
  },
  labelPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  divider: {
    height: StyleSheet.hairlineWidth, backgroundColor: BORDER, marginTop: 8, marginBottom: 8, marginHorizontal: 12,
  },
  watchTrailerBtn: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    borderWidth: 1.3, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 10,
  },
  watchTrailerIcon: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  watchTrailerIconText: { color: '#fff', fontSize: 11, marginLeft: 1 },
  watchTrailerBtnText: { fontSize: 13.5, fontWeight: '800' },
  statusBlock: { alignItems: 'flex-start' },
  statusIcon: { fontSize: 18, marginBottom: 2 },
  statusText: { color: INK, fontSize: 14, fontWeight: '800' },
  detailText: { color: DIM, fontSize: 11.5, marginTop: 2, lineHeight: 15 },
  airingText: { color: '#c48fd9', fontWeight: '700' },
  airedDoneText: { color: '#4fb894', fontWeight: '700' },
  etaText: { color: '#d9a441', fontSize: 11.5, marginTop: 4, fontWeight: '700' },
  barTrack: {
    alignSelf: 'stretch',
    height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden', marginTop: 6,
  },
  barFill: { height: '100%', borderRadius: 3 },
  watchedToggle: {
    marginTop: 8, borderWidth: 1.3, borderRadius: 8,
    paddingVertical: 7, paddingHorizontal: 12, alignSelf: 'stretch', alignItems: 'center',
  },
  watchedToggleText: { fontSize: 12.5, fontWeight: '800' },
  notesBlock: {
    marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
  },
  notesLabel: { color: DIM, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  notesText: { color: '#c3ccd6', fontSize: 11.5, lineHeight: 16, marginTop: 4 },
  stepperRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  stepBtn: {
    borderWidth: 1.3, borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 13,
  },
  stepBtnText: { fontSize: 12, fontWeight: '800' },
  backActions: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: BORDER,
    padding: 8,
  },
  actionChip: {
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8,
    paddingVertical: 5, paddingHorizontal: 9,
  },
  actionChipText: { color: '#8fc4e8', fontSize: 11, fontWeight: '700' },
  archiveChip: { backgroundColor: 'rgba(63,143,130,0.18)' },
  archiveChipText: { color: '#4fb894', fontSize: 11, fontWeight: '700' },

  // Full-screen trailer player - a real size to actually watch, instead
  // of the small WebView that used to be squeezed into a flipped card.
  trailerModal: { flex: 1, backgroundColor: '#0c0a0a' },
  trailerPlayerWrap: {
    width: '100%', backgroundColor: '#000', position: 'relative',
  },
  trailerCloseBtn: {
    position: 'absolute', top: 14, right: 14,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  trailerCloseBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  trailerInfoInner: { padding: 18, paddingBottom: 40 },
  trailerTitle: { color: INK, fontSize: 20, fontWeight: '800', lineHeight: 26 },
  trailerExternalBtn: { marginTop: 18, alignSelf: 'flex-start' },
  trailerExternalBtnText: { color: '#8fc4e8', fontSize: 12.5, fontWeight: '700' },
});
