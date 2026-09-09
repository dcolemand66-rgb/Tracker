import React, { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { shared, GOLD, INK, DIM, CARD, BORDER, JADE, ROSE } from './theme';
import { fetchLinkPreview } from './linkPreview';
import LinkCard from './LinkCard';
import { fetchIdleonProfile, usernameFromProfileUrl } from './idleonSync';

function makeId(prefix) {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 8);
}

function normalizeUrl(raw) {
  const v = (raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  return 'https://' + v;
}

const STATUS_ORDER = ['todo', 'in_progress', 'done'];
const STATUS_META = {
  todo: { label: 'Not started', color: DIM, dot: '○' },
  in_progress: { label: 'In progress', color: GOLD, dot: '◐' },
  done: { label: 'Done', color: JADE, dot: '●' },
};

function nextStatus(s) {
  const i = STATUS_ORDER.indexOf(s || 'todo');
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length];
}

export default function IdleonTrackerScreen({ tracker, setTracker, onBack }) {
  const categories = tracker?.categories || [];
  const links = tracker?.links || [];
  const characters = tracker?.characters || [];
  const [newCatName, setNewCatName] = useState('');
  const [draftItem, setDraftItem] = useState({}); // { [catId]: text }
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');

  // Detects a username to sync from whichever saved link points at an
  // idleonefficiency.com profile subdomain - no separate field to fill
  // in if you've already saved your profile link above.
  const detectedUsername = links.map((l) => usernameFromProfileUrl(l.url)).find(Boolean) || '';

  async function syncCharacters() {
    if (!detectedUsername) {
      Alert.alert(
        'No profile link found',
        'Save your Idleon Efficiency profile link above first (e.g. https://yourname.idleonefficiency.com).'
      );
      return;
    }
    setSyncing(true);
    setSyncError('');
    try {
      const { characters: chars, fetchedAt } = await fetchIdleonProfile(detectedUsername);
      setTracker((prev) => ({ ...prev, characters: chars, charactersSyncedAt: fetchedAt }));
    } catch (e) {
      setSyncError(e && e.message ? e.message : "Couldn't sync characters.");
    } finally {
      setSyncing(false);
    }
  }

  // Links section - same idea as the Websites category in Information,
  // just scoped to this tracker (your account page, wiki pages, etc).
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState({ title: '', url: '', notes: '', image: '', description: '' });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [backfillingId, setBackfillingId] = useState(null);
  const previewDebounce = useRef(null);

  function addCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setTracker((prev) => ({
      ...prev,
      categories: [...(prev.categories || []), { id: makeId('ic'), name, items: [] }],
    }));
    setNewCatName('');
  }

  function removeCategory(catId) {
    setTracker((prev) => ({
      ...prev,
      categories: (prev.categories || []).filter((c) => c.id !== catId),
    }));
  }

  function addItem(catId) {
    const text = (draftItem[catId] || '').trim();
    if (!text) return;
    setTracker((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((c) =>
        c.id === catId
          ? { ...c, items: [...c.items, { id: makeId('ii'), name: text, status: 'todo', note: '' }] }
          : c
      ),
    }));
    setDraftItem((d) => ({ ...d, [catId]: '' }));
  }

  function cycleItem(catId, itemId) {
    setTracker((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((c) =>
        c.id !== catId
          ? c
          : {
              ...c,
              items: c.items.map((it) =>
                it.id === itemId ? { ...it, status: nextStatus(it.status) } : it
              ),
            }
      ),
    }));
  }

  function removeItem(catId, itemId) {
    setTracker((prev) => ({
      ...prev,
      categories: (prev.categories || []).map((c) =>
        c.id !== catId ? c : { ...c, items: c.items.filter((it) => it.id !== itemId) }
      ),
    }));
  }

  function openLinkForm() {
    setLinkDraft({ title: '', url: '', notes: '', image: '', description: '' });
    setPreviewError('');
    setLinkFormOpen(true);
  }

  // Fetches title/description/thumbnail automatically - on a short pause
  // while typing and again on blur - so a saved link doesn't end up
  // preview-less just because nobody remembered to tap a button.
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
    previewDebounce.current = setTimeout(() => {
      if (/\.[a-z]{2,}/i.test(v)) runPreview(v);
    }, 700);
  }

  function saveLink() {
    const title = linkDraft.title.trim();
    const url = normalizeUrl(linkDraft.url);
    if (!title || !url) {
      Alert.alert('Title and link required', 'Give this entry a title and a URL.');
      return;
    }
    const entry = {
      id: makeId('il'),
      title,
      url,
      notes: linkDraft.notes.trim(),
      image: linkDraft.image || '',
      description: linkDraft.description || '',
    };
    setTracker((prev) => ({ ...prev, links: [...(prev.links || []), entry] }));
    setLinkFormOpen(false);
  }

  function removeLink(id) {
    setTracker((prev) => ({ ...prev, links: (prev.links || []).filter((l) => l.id !== id) }));
  }

  // Backfills a thumbnail for a link that was already saved without one
  // (e.g. the preview fetch failed the first time, or it predates this).
  async function backfillPreview(link) {
    setBackfillingId(link.id);
    try {
      const preview = await fetchLinkPreview(link.url);
      if (preview.image || preview.description) {
        setTracker((prev) => ({
          ...prev,
          links: (prev.links || []).map((l) =>
            l.id === link.id
              ? { ...l, image: preview.image || l.image, description: preview.description || l.description }
              : l
          ),
        }));
      } else {
        Alert.alert("No preview found", "That page doesn't expose a preview image or description.");
      }
    } catch (e) {
      Alert.alert("Couldn't fetch preview", e && e.message ? e.message : 'Try again later.');
    } finally {
      setBackfillingId(null);
    }
  }

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
  const doneItems = categories.reduce((n, c) => n + c.items.filter((it) => it.status === 'done').length, 0);

  return (
    <ScrollView style={shared.safe} contentContainerStyle={shared.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Side Quests</Text>
      </TouchableOpacity>
      <Text style={shared.h1}>🎮 Idleon</Text>
      <Text style={shared.tagline}>
        {totalItems ? `${doneItems}/${totalItems} tracked items done` : 'Your own account tracker — add categories and items below.'}
      </Text>

      <View style={styles.linkRow}>
        <TouchableOpacity onPress={() => Linking.openURL('https://www.idleonefficiency.com/')}>
          <Text style={styles.linkText}>Idleon Efficiency ↗</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Linking.openURL('https://ieautoreview-scoli.pythonanywhere.com/')}>
          <Text style={styles.linkText}>Auto Review ↗</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.note}>
        Those tools pull live data straight from your synced game save to generate ranked advice — this page can't
        replicate that automatically, so it's a manual tracker instead: log what you're working on and check things
        off yourself as you go.
      </Text>

      <View style={shared.block}>
        <View style={shared.blockHead}>
          <Text style={shared.blockTitle}>Characters</Text>
          {tracker?.charactersSyncedAt ? (
            <Text style={styles.syncedAt}>
              Synced {new Date(tracker.charactersSyncedAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        {characters.length === 0 ? (
          <Text style={[shared.tagline, { marginBottom: 8 }]}>
            {detectedUsername
              ? 'Pull your real character names, classes, and combat levels from your public Idleon Efficiency profile.'
              : 'Save your Idleon Efficiency profile link above, then sync to pull in your real characters.'}
          </Text>
        ) : (
          characters.map((c, i) => (
            <View key={`${c.name}-${i}`} style={styles.charRow}>
              <Text style={styles.charName}>{c.name}</Text>
              <Text style={styles.charMeta}>
                {c.className}{c.level != null ? ` · Lv ${c.level}` : ''}
              </Text>
            </View>
          ))
        )}
        {syncError ? <Text style={styles.previewError}>{syncError}</Text> : null}
        <TouchableOpacity
          style={[styles.addBtn, { marginTop: 10 }]}
          onPress={syncCharacters}
          disabled={syncing || !detectedUsername}
        >
          {syncing ? (
            <ActivityIndicator color="#1c1206" size="small" />
          ) : (
            <Text style={styles.addBtnText}>{characters.length ? 'Re-sync Characters' : 'Sync Characters'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={shared.block}>
        <View style={shared.blockHead}>
          <Text style={shared.blockTitle}>Links</Text>
        </View>
        {links.length === 0 ? (
          <Text style={[shared.tagline, { marginBottom: 8 }]}>
            Save your Idleon Efficiency profile, wiki pages, or anything else worth keeping handy.
          </Text>
        ) : (
          links.map((l) => (
            <LinkCard
              key={l.id}
              link={l}
              onDelete={removeLink}
              onBackfillPreview={backfillPreview}
              backfilling={backfillingId === l.id}
            />
          ))
        )}
        {linkFormOpen ? (
          <View>
            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={linkDraft.title}
              onChangeText={(v) => setLinkDraft((d) => ({ ...d, title: v }))}
              placeholder="e.g. Idleon Efficiency Profile"
              placeholderTextColor={DIM}
            />
            <Text style={styles.label}>URL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={linkDraft.url}
                onChangeText={onUrlChange}
                onBlur={() => runPreview(linkDraft.url)}
                placeholder="e.g. demarcus1234.idleonefficiency.com"
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
                  <Text style={styles.linkCardDescription} numberOfLines={3}>{linkDraft.description}</Text>
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
            <TouchableOpacity style={styles.addBtn} onPress={saveLink}>
              <Text style={styles.addBtnText}>Save Link</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 10 }} onPress={() => setLinkFormOpen(false)}>
              <Text style={{ color: DIM, fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={[styles.addBtn, { marginTop: 10 }]} onPress={openLinkForm}>
            <Text style={styles.addBtnText}>+ Add Link</Text>
          </TouchableOpacity>
        )}
      </View>

      {categories.map((cat) => {
        const catDone = cat.items.filter((it) => it.status === 'done').length;
        return (
          <View key={cat.id} style={shared.block}>
            <View style={shared.blockHead}>
              <Text style={shared.blockTitle}>{cat.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {cat.items.length ? (
                  <Text style={styles.catCount}>
                    {catDone}/{cat.items.length}
                  </Text>
                ) : null}
                <TouchableOpacity onPress={() => removeCategory(cat.id)} style={{ marginLeft: 10, padding: 4 }}>
                  <Text style={{ color: ROSE, fontSize: 13 }}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>

            {cat.items.map((it) => {
              const meta = STATUS_META[it.status] || STATUS_META.todo;
              return (
                <View key={it.id} style={styles.itemRow}>
                  <TouchableOpacity onPress={() => cycleItem(cat.id, it.id)} style={styles.statusDot}>
                    <Text style={{ color: meta.color, fontSize: 16 }}>{meta.dot}</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.itemText}>{it.name}</Text>
                    <Text style={[styles.itemStatus, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeItem(cat.id, it.id)} style={{ padding: 6 }}>
                    <Text style={{ color: DIM, fontSize: 15 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <View style={styles.addItemRow}>
              <TextInput
                style={styles.itemInput}
                value={draftItem[cat.id] || ''}
                onChangeText={(v) => setDraftItem((d) => ({ ...d, [cat.id]: v }))}
                placeholder="Add an item..."
                placeholderTextColor={DIM}
                onSubmitEditing={() => addItem(cat.id)}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.smallAddBtn} onPress={() => addItem(cat.id)}>
                <Text style={styles.smallAddBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      <View style={styles.addCatRow}>
        <TextInput
          style={styles.input}
          value={newCatName}
          onChangeText={setNewCatName}
          placeholder="New category, e.g. World 4"
          placeholderTextColor={DIM}
          onSubmitEditing={addCategory}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addCategory}>
          <Text style={styles.addBtnText}>Add Category</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backLink: { color: GOLD, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  linkRow: { flexDirection: 'row', marginBottom: 8 },
  linkText: { color: GOLD, fontSize: 13, fontWeight: '600', marginRight: 18, textDecorationLine: 'underline' },
  note: { color: DIM, fontSize: 12, marginBottom: 18, lineHeight: 17 },
  linkCardDescription: { color: DIM, fontSize: 12, marginTop: 3, lineHeight: 16 },
  syncedAt: { color: DIM, fontSize: 11 },
  charRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  charName: { color: INK, fontSize: 14, fontWeight: '700' },
  charMeta: { color: DIM, fontSize: 12 },
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
  previewImage: { width: '100%', height: 120, backgroundColor: '#14100c' },
  catCount: { color: DIM, fontSize: 12, fontWeight: '600' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  statusDot: { width: 20, alignItems: 'center' },
  itemText: { color: INK, fontSize: 14 },
  itemStatus: { fontSize: 11, marginTop: 1, fontWeight: '600' },
  addItemRow: { flexDirection: 'row', marginTop: 10 },
  itemInput: {
    flex: 1,
    backgroundColor: '#1f1a15',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: INK,
    fontSize: 13,
    marginRight: 8,
  },
  smallAddBtn: {
    backgroundColor: GOLD,
    borderRadius: 8,
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallAddBtnText: { color: '#1c1206', fontWeight: '800', fontSize: 16 },
  addCatRow: { flexDirection: 'row', marginTop: 4, marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: INK,
    marginRight: 8,
  },
  addBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#1c1206', fontWeight: '700', fontSize: 13 },
});
