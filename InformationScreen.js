import React, { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { shared, GOLD, ROSE, INK, DIM, CARD, BORDER } from './theme';
import { fetchLinkPreview } from './linkPreview';
import LinkCard from './LinkCard';

const PERMANENT_TILES = [
  { id: 'recipes', name: 'Recipes', icon: '🍛', color: '#b8705c' },
  { id: 'dating', name: 'Dating', icon: '💕', color: '#b85c8f' },
  { id: 'traveling', name: 'Traveling', icon: '✈️', color: '#4a7ba6' },
  { id: 'inventory', name: 'Inventory', icon: '📦', color: '#8a9a4b' },
  { id: 'restaurants', name: 'Restaurants', icon: '🍽️', color: '#c2685a' },
  { id: 'websites', name: 'Websites', icon: '🌐', color: '#3f8f82' },
];

function makeLinkId() {
  return 'lk' + Date.now() + Math.random().toString(36).slice(2, 8);
}

// A saved link is just { id, title, url, notes, image, description }.
// Tapping it opens the URL; a normalizeUrl step means "example.com" and
// "www.example.com" both work without the user having to remember to
// type https://.
function normalizeUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return v;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return v;
  return 'https://' + v;
}

export default function InformationScreen({
  infoCategories,
  setInfoCategories,
  infoLinks,
  setInfoLinks,
  onNavigate,
}) {
  const [linksOpenFor, setLinksOpenFor] = useState(null); // category id
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ title: '', url: '', notes: '', image: '', description: '' });
  const [editingLinkId, setEditingLinkId] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [backfillingId, setBackfillingId] = useState(null);
  const previewDebounce = useRef(null);

  function deleteCategory(id) {
    Alert.alert('Delete category?', 'This also removes any links saved in it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setInfoCategories((prev) => prev.filter((c) => c.id !== id));
          setInfoLinks((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
          setLinksOpenFor(null);
        },
      },
    ]);
  }

  function handleTilePress(id) {
    if (id === 'recipes') return onNavigate('recipes');
    if (id === 'dating') return onNavigate('places', 'dating');
    if (id === 'traveling') return onNavigate('travel');
    if (id === 'inventory') return onNavigate('inventory');
    if (id === 'restaurants') return onNavigate('restaurants');
    // Websites, and any leftover custom categories, are a link tracker -
    // opens as its own full page below, not a popup over this one.
    setLinksOpenFor(id);
    setLinkFormOpen(false);
  }

  function openLinkForm(existing) {
    setPreviewError('');
    setPreviewLoading(false);
    if (existing) {
      setEditingLinkId(existing.id);
      setLinkDraft({
        title: existing.title,
        url: existing.url,
        notes: existing.notes || '',
        image: existing.image || '',
        description: existing.description || '',
      });
    } else {
      setEditingLinkId(null);
      setLinkDraft({ title: '', url: '', notes: '', image: '', description: '' });
    }
    setLinkFormOpen(true);
  }

  // Loads the page's title/description/preview image so a saved link
  // shows a real thumbnail instead of just a bare URL. Title only
  // auto-fills if the user hasn't already typed one themselves. Runs
  // automatically - on a short pause while typing and again on blur -
  // there's no manual button to remember to press.
  async function runPreview(rawUrl) {
    const url = normalizeUrl(rawUrl);
    if (!url) return;
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const preview = await fetchLinkPreview(url);
      setLinkDraft((d) => ({
        ...d,
        url,
        title: d.title.trim() ? d.title : preview.title || d.title,
        image: preview.image || d.image,
        description: preview.description || d.description,
      }));
    } catch (e) {
      setPreviewError(e && e.message ? e.message : "Couldn't load a preview for that link.");
    } finally {
      setPreviewLoading(false);
    }
  }

  function onUrlChange(v) {
    setLinkDraft((d) => ({ ...d, url: v }));
    if (previewDebounce.current) clearTimeout(previewDebounce.current);
    // A bit more than a comfortable pause between keystrokes - fires
    // while the user is still mid-edit without hammering the network on
    // every character.
    previewDebounce.current = setTimeout(() => {
      if (/\.[a-z]{2,}/i.test(v)) runPreview(v);
    }, 700);
  }

  // Backfills a thumbnail for a link that's already saved without one -
  // e.g. the auto-fetch failed the first time, or it predates this.
  async function backfillPreview(link) {
    setBackfillingId(link.id);
    try {
      const preview = await fetchLinkPreview(link.url);
      if (preview.image || preview.description) {
        setInfoLinks((prev) => ({
          ...prev,
          [linksOpenFor]: (prev[linksOpenFor] || []).map((l) =>
            l.id === link.id
              ? { ...l, image: preview.image || l.image, description: preview.description || l.description }
              : l
          ),
        }));
      } else {
        Alert.alert('No preview found', "That page doesn't expose a preview image or description.");
      }
    } catch (e) {
      Alert.alert("Couldn't fetch preview", e && e.message ? e.message : 'Try again later.');
    } finally {
      setBackfillingId(null);
    }
  }

  function saveLink() {
    const title = linkDraft.title.trim();
    const url = linkDraft.url.trim();
    if (!title || !url) {
      Alert.alert('Title and link required', 'Give this entry a title and a URL.');
      return;
    }
    const entry = {
      id: editingLinkId || makeLinkId(),
      title,
      url: normalizeUrl(url),
      notes: linkDraft.notes.trim(),
      image: linkDraft.image || '',
      description: linkDraft.description || '',
    };
    setInfoLinks((prev) => {
      const list = prev[linksOpenFor] || [];
      const next = editingLinkId
        ? list.map((l) => (l.id === editingLinkId ? entry : l))
        : [...list, entry];
      return { ...prev, [linksOpenFor]: next };
    });
    setLinkFormOpen(false);
    setEditingLinkId(null);
    setLinkDraft({ title: '', url: '', notes: '', image: '', description: '' });
  }

  function deleteLink(id) {
    setInfoLinks((prev) => ({
      ...prev,
      [linksOpenFor]: (prev[linksOpenFor] || []).filter((l) => l.id !== id),
    }));
  }

  const activeCustomCategory = infoCategories.find((c) => c.id === linksOpenFor);
  const activePermanentTile = PERMANENT_TILES.find((t) => t.id === linksOpenFor);
  const activeCategory = activeCustomCategory || activePermanentTile;
  const activeLinks = infoLinks[linksOpenFor] || [];

  if (linksOpenFor) {
    return (
      <ScrollView style={shared.safe} contentContainerStyle={shared.container}>
        <TouchableOpacity onPress={() => setLinksOpenFor(null)}>
          <Text style={styles.backLink}>‹ Information</Text>
        </TouchableOpacity>
        <View style={styles.headerRow}>
          <Text style={shared.h1}>{activeCategory?.name}</Text>
          {activeCustomCategory ? (
            <TouchableOpacity onPress={() => deleteCategory(linksOpenFor)}>
              <Text style={styles.deleteCatText}>Delete category</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {activeLinks.length === 0 ? (
          <Text style={[shared.tagline, { marginBottom: 12 }]}>No links saved here yet.</Text>
        ) : (
          activeLinks.map((l) => (
            <LinkCard
              key={l.id}
              link={l}
              onEdit={openLinkForm}
              onDelete={deleteLink}
              onBackfillPreview={backfillPreview}
              backfilling={backfillingId === l.id}
            />
          ))
        )}

        {linkFormOpen ? (
          <View style={shared.block}>
            <Text style={shared.blockTitle}>{editingLinkId ? 'Edit Link' : 'New Link'}</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={linkDraft.title}
              onChangeText={(v) => setLinkDraft((d) => ({ ...d, title: v }))}
              placeholder="e.g. Idleon Wiki"
              placeholderTextColor={DIM}
            />
            <Text style={styles.label}>URL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={linkDraft.url}
                onChangeText={onUrlChange}
                onBlur={() => runPreview(linkDraft.url)}
                placeholder="e.g. idleon.wiki.gg"
                placeholderTextColor={DIM}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {previewLoading ? <ActivityIndicator color={GOLD} size="small" style={{ marginLeft: 10 }} /> : null}
            </View>
            {previewError ? <Text style={styles.previewError}>{previewError}</Text> : null}
            {linkDraft.image ? (
              <View style={styles.previewCard}>
                <Image source={{ uri: linkDraft.image }} style={styles.previewImage} />
                {linkDraft.description ? (
                  <Text style={styles.previewDescription} numberOfLines={3}>
                    {linkDraft.description}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
              value={linkDraft.notes}
              onChangeText={(v) => setLinkDraft((d) => ({ ...d, notes: v }))}
              placeholder="Anything worth remembering about this one"
              placeholderTextColor={DIM}
              multiline
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveLink}>
              <Text style={styles.saveBtnText}>{editingLinkId ? 'Save Changes' : 'Add Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setLinkFormOpen(false)}>
              <Text style={{ color: DIM, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.saveBtn} onPress={() => openLinkForm(null)}>
            <Text style={styles.saveBtnText}>+ Add Link</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={shared.container}>
      <Text style={shared.h1}>Information</Text>
      <Text style={shared.tagline}>Recipes, places, and body — all in one spot</Text>

      <View style={styles.grid}>
        {PERMANENT_TILES.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tile, { backgroundColor: t.color }]}
            onPress={() => handleTilePress(t.id)}
          >
            <Text style={styles.tileIcon}>{t.icon}</Text>
            <Text style={styles.tileName}>{t.name}</Text>
          </TouchableOpacity>
        ))}
        {infoCategories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.tile, { backgroundColor: c.color }]}
            onPress={() => handleTilePress(c.id)}
          >
            <Text style={styles.tileIcon}>{c.icon}</Text>
            <Text style={styles.tileName}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: {
    width: '48%',
    aspectRatio: 1.4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  tileIcon: { fontSize: 30, marginBottom: 6 },
  tileName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  backLink: { color: GOLD, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  deleteCatText: { color: ROSE, fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: DIM, marginTop: 12, marginBottom: 6 },
  previewError: { color: ROSE, fontSize: 12, marginTop: 6 },
  previewCard: {
    marginTop: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
  },
  previewImage: { width: '100%', height: 130, backgroundColor: '#14100c' },
  previewDescription: { color: DIM, fontSize: 12, padding: 10, lineHeight: 16 },
  input: {
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: INK,
  },
  saveBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  saveBtnText: { color: '#1c1206', fontSize: 16, fontWeight: '700' },
});
