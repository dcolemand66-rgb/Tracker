import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { shared, GOLD, ROSE, INK, DIM, CARD, BORDER } from './theme';

const PERMANENT_TILES = [
  { id: 'recipes', name: 'Recipes', icon: '🍛', color: '#b8705c' },
  { id: 'dating', name: 'Dating', icon: '💕', color: '#b85c8f' },
  { id: 'traveling', name: 'Traveling', icon: '✈️', color: '#4a7ba6' },
  { id: 'inventory', name: 'Inventory', icon: '📦', color: '#8a9a4b' },
  { id: 'restaurants', name: 'Restaurants', icon: '🍽️', color: '#c2685a' },
];

const ICON_CHOICES = ['📌','📖','🎓','🏠','🚗','⚕️','📄','🔧','🌱','🎁','📷','🎵','🧳','💼','🗂️'];
const COLOR_CHOICES = ['#b8705c','#3f8f82','#bc9440','#7b6ca6','#5b7b8b','#4a7ba6','#8a9a4b','#c2685a'];

function makeId() {
  return 'ic' + Date.now() + Math.random().toString(36).slice(2, 8);
}
function makeLinkId() {
  return 'lk' + Date.now() + Math.random().toString(36).slice(2, 8);
}

// A saved link is just { id, title, url, notes }. Tapping it opens the
// URL; a normalizeUrl step means "example.com" and "www.example.com"
// both work without the user having to remember to type https://.
function normalizeUrl(raw) {
  const v = raw.trim();
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
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', icon: ICON_CHOICES[0], color: COLOR_CHOICES[0] });
  const [linksOpenFor, setLinksOpenFor] = useState(null); // category id
  const [linkDraft, setLinkDraft] = useState({ title: '', url: '', notes: '' });
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [editingLinkId, setEditingLinkId] = useState(null);

  function saveCategory() {
    const name = draft.name.trim();
    if (!name) {
      Alert.alert('Name required', 'Give this category a name.');
      return;
    }
    setInfoCategories((prev) => [
      ...prev,
      { id: makeId(), name, icon: draft.icon, color: draft.color },
    ]);
    setDraft({ name: '', icon: ICON_CHOICES[0], color: COLOR_CHOICES[0] });
    setModalOpen(false);
  }

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
    // Custom categories are a link tracker — the site for saving
    // important URLs (and, per Idleon/Soul-Arena, any manually-entered
    // notes/links for whatever the category is about).
    setLinksOpenFor(id);
  }

  function openLinkForm(existing) {
    if (existing) {
      setEditingLinkId(existing.id);
      setLinkDraft({ title: existing.title, url: existing.url, notes: existing.notes || '' });
    } else {
      setEditingLinkId(null);
      setLinkDraft({ title: '', url: '', notes: '' });
    }
    setLinkFormOpen(true);
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
    setLinkDraft({ title: '', url: '', notes: '' });
  }

  function deleteLink(id) {
    setInfoLinks((prev) => ({
      ...prev,
      [linksOpenFor]: (prev[linksOpenFor] || []).filter((l) => l.id !== id),
    }));
  }

  function openLink(url) {
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open that link"));
  }

  const activeCategory = infoCategories.find((c) => c.id === linksOpenFor);
  const activeLinks = infoLinks[linksOpenFor] || [];

  return (
    <View style={{ flex: 1 }}>
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
          <TouchableOpacity style={styles.addTile} onPress={() => setModalOpen(true)}>
            <Text style={{ fontSize: 24, color: DIM, marginBottom: 4 }}>+</Text>
            <Text style={styles.addTileText}>Add Category</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={modalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>New Category</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={draft.name}
              onChangeText={(v) => setDraft((d) => ({ ...d, name: v }))}
              placeholder="e.g. Home Maintenance"
              placeholderTextColor="#9aa5b1"
            />
            <Text style={styles.label}>Icon</Text>
            <View style={styles.rowWrap}>
              {ICON_CHOICES.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBtn, draft.icon === ic && styles.iconBtnSel]}
                  onPress={() => setDraft((d) => ({ ...d, icon: ic }))}
                >
                  <Text style={{ fontSize: 18 }}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Color</Text>
            <View style={styles.rowWrap}>
              {COLOR_CHOICES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    draft.color === c && styles.colorDotSel,
                  ]}
                  onPress={() => setDraft((d) => ({ ...d, color: c }))}
                />
              ))}
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={saveCategory}>
              <Text style={styles.saveBtnText}>Add Category</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!linksOpenFor}
        animationType="slide"
        transparent
        onRequestClose={() => setLinksOpenFor(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeaderRow}>
              <Text style={styles.sheetTitle}>{activeCategory?.name}</Text>
              <TouchableOpacity onPress={() => deleteCategory(linksOpenFor)}>
                <Text style={styles.deleteCatText}>Delete category</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              {activeLinks.length === 0 ? (
                <Text style={[shared.tagline, { marginBottom: 12 }]}>
                  No links saved here yet.
                </Text>
              ) : (
                activeLinks.map((l) => (
                  <View key={l.id} style={styles.linkRow}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => openLink(l.url)}>
                      <Text style={styles.linkTitle}>{l.title}</Text>
                      <Text style={styles.linkUrl} numberOfLines={1}>{l.url}</Text>
                      {l.notes ? <Text style={styles.linkNotes}>{l.notes}</Text> : null}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkAction} onPress={() => openLinkForm(l)}>
                      <Text style={styles.linkActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.linkAction} onPress={() => deleteLink(l.id)}>
                      <Text style={[styles.linkActionText, { color: ROSE }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>
            <TouchableOpacity style={styles.saveBtn} onPress={() => openLinkForm(null)}>
              <Text style={styles.saveBtnText}>+ Add Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinksOpenFor(null)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={linkFormOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setLinkFormOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingLinkId ? 'Edit Link' : 'New Link'}</Text>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={linkDraft.title}
              onChangeText={(v) => setLinkDraft((d) => ({ ...d, title: v }))}
              placeholder="e.g. Idleon Wiki"
              placeholderTextColor="#9aa5b1"
            />
            <Text style={styles.label}>URL</Text>
            <TextInput
              style={styles.input}
              value={linkDraft.url}
              onChangeText={(v) => setLinkDraft((d) => ({ ...d, url: v }))}
              placeholder="e.g. idleon.wiki.gg"
              placeholderTextColor="#9aa5b1"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
              value={linkDraft.notes}
              onChangeText={(v) => setLinkDraft((d) => ({ ...d, notes: v }))}
              placeholder="Anything worth remembering about this one"
              placeholderTextColor="#9aa5b1"
              multiline
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveLink}>
              <Text style={styles.saveBtnText}>{editingLinkId ? 'Save Changes' : 'Add Link'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setLinkFormOpen(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
  addTile: {
    width: '48%',
    aspectRatio: 1.4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  addTileText: { color: DIM, fontSize: 14, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: INK, marginBottom: 12 },
  sheetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deleteCatText: { color: ROSE, fontSize: 12, fontWeight: '600', marginBottom: 12 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  linkTitle: { color: INK, fontSize: 15, fontWeight: '700' },
  linkUrl: { color: GOLD, fontSize: 12, marginTop: 2 },
  linkNotes: { color: DIM, fontSize: 12, marginTop: 4 },
  linkAction: { paddingHorizontal: 8, paddingVertical: 6 },
  linkActionText: { color: DIM, fontSize: 12, fontWeight: '600' },
  label: { fontSize: 12, fontWeight: '600', color: DIM, marginTop: 12, marginBottom: 6 },
  input: {
    backgroundColor: '#232d3a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: INK,
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#232d3a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  iconBtnSel: { backgroundColor: '#332a13', borderWidth: 2, borderColor: GOLD },
  colorDot: { width: 34, height: 34, borderRadius: 17, marginRight: 10, marginBottom: 10 },
  colorDotSel: { borderWidth: 3, borderColor: INK },
  saveBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  cancelBtnText: { color: DIM, fontSize: 14 },
});

