import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, PanResponder, Platform,
} from 'react-native';
import { api, getSocket } from './api';
import { colors, priorityColor, confirmAsync } from './theme';
import CardModal from './CardModal';

const BOARD_ID = 1;
const COL_WIDTH = 280;

// ---------- Kartu ----------
function Card({ card, onOpen, dragHandlers, isDragSource }) {
  const latest = useRef({});
  latest.current = dragHandlers;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) =>
        latest.current.start(card, e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderMove: (e) =>
        latest.current.move(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderRelease: (e) =>
        latest.current.end(e.nativeEvent.pageX, e.nativeEvent.pageY),
      onPanResponderTerminate: () => latest.current.cancel(),
    })
  ).current;

  return (
    <View
      ref={dragHandlers.registerCard(card.id)}
      style={[s.card, { borderLeftColor: priorityColor(card.priority) }, isDragSource && { opacity: 0.35 }]}
    >
      <TouchableOpacity style={{ flex: 1 }} onPress={() => onOpen(card)}>
        <Text style={s.cardTitle}>{card.title}</Text>
        <View style={s.cardMeta}>
          {!!card.barcode && <Text style={s.badge}>▮▯ {card.barcode}</Text>}
          {!!card.due_date && (
            <Text style={s.badge}>⏰ {String(card.due_date).slice(0, 10)}</Text>
          )}
          {!!card.photos?.length && <Text style={s.badge}>🖼 {card.photos.length}</Text>}
        </View>
      </TouchableOpacity>
      <View {...pan.panHandlers} style={s.handle} accessibilityLabel="Seret kartu">
        <Text style={s.handleText}>⠿</Text>
      </View>
    </View>
  );
}

// ---------- Kolom ----------
function Column({ list, onOpenCard, dragHandlers, dragging, hovered, onChanged }) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(list.name);

  const addCard = async () => {
    const t = newTitle.trim();
    if (!t) return setAdding(false);
    setNewTitle('');
    await api.createCard({ list_id: list.id, title: t });
    onChanged();
  };

  const rename = async () => {
    setEditing(false);
    const n = name.trim();
    if (n && n !== list.name) {
      await api.updateList(list.id, { name: n });
      onChanged();
    } else setName(list.name);
  };

  const removeList = async () => {
    if (!(await confirmAsync('Hapus kolom?', `"${list.name}" beserta semua kartunya akan dihapus.`))) return;
    await api.deleteList(list.id);
    onChanged();
  };

  return (
    <View
      ref={dragHandlers.registerColumn(list.id)}
      style={[s.column, hovered && { backgroundColor: '#dbe7f5' }]}
    >
      <View style={s.colHeader}>
        {editing ? (
          <TextInput
            style={s.colTitleInput}
            value={name}
            onChangeText={setName}
            onBlur={rename}
            onSubmitEditing={rename}
            autoFocus
          />
        ) : (
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setEditing(true)}>
            <Text style={s.colTitle}>
              {list.name} <Text style={s.colCount}>({list.cards.length})</Text>
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={removeList} hitSlop={8}>
          <Text style={s.colDelete}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flexGrow: 0 }} scrollEnabled={!dragging}>
        {list.cards.map((c) => (
          <Card
            key={c.id}
            card={c}
            onOpen={onOpenCard}
            dragHandlers={dragHandlers}
            isDragSource={dragging?.card?.id === c.id}
          />
        ))}
      </ScrollView>

      {adding ? (
        <TextInput
          style={s.addInput}
          placeholder="Judul task..."
          value={newTitle}
          onChangeText={setNewTitle}
          onSubmitEditing={addCard}
          onBlur={addCard}
          autoFocus
        />
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={() => setAdding(true)}>
          <Text style={s.addBtnText}>＋ Tambah task</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ---------- Board ----------
export default function BoardScreen() {
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [openCard, setOpenCard] = useState(null);
  const [drag, setDrag] = useState(null); // { card, x, y }
  const [hoverList, setHoverList] = useState(null);
  const [addingList, setAddingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [connected, setConnected] = useState(false);

  const colRefs = useRef({});
  const cardRefs = useRef({});
  const rootRef = useRef(null);
  const meta = useRef({ colRects: {}, cardRects: {}, rootOrigin: { x: 0, y: 0 } });
  const boardRef = useRef(null);
  boardRef.current = board;

  const refetch = useCallback(async () => {
    try {
      const b = await api.getBoard(BOARD_ID);
      setBoard(b);
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refetch();
    const socket = getSocket();
    socket.emit('board:join', BOARD_ID);
    const onChange = () => refetch();
    socket.on('board:changed', onChange);
    socket.on('connect', () => { setConnected(true); socket.emit('board:join', BOARD_ID); });
    socket.on('disconnect', () => setConnected(false));
    if (socket.connected) setConnected(true);
    return () => {
      socket.emit('board:leave', BOARD_ID);
      socket.off('board:changed', onChange);
    };
  }, [refetch]);

  // Sinkronkan kartu yang sedang dibuka di modal dengan data terbaru.
  useEffect(() => {
    if (!openCard || !board) return;
    for (const l of board.lists) {
      const found = l.cards.find((c) => c.id === openCard.id);
      if (found) return setOpenCard(found);
    }
    setOpenCard(null); // kartu dihapus dari perangkat lain
  }, [board]);

  // ----- Drag & drop -----
  const measureAll = () => {
    meta.current = { colRects: {}, cardRects: {}, rootOrigin: { x: 0, y: 0 } };
    rootRef.current?.measureInWindow((x, y) => { meta.current.rootOrigin = { x, y }; });
    for (const [listId, ref] of Object.entries(colRefs.current)) {
      ref?.measureInWindow?.((x, y, w, h) => {
        meta.current.colRects[listId] = { x, y, w, h };
      });
    }
    for (const [cardId, ref] of Object.entries(cardRefs.current)) {
      ref?.measureInWindow?.((x, y, w, h) => {
        meta.current.cardRects[cardId] = { x, y, w, h };
      });
    }
  };

  const findColumnAt = (x) => {
    for (const [listId, r] of Object.entries(meta.current.colRects)) {
      if (x >= r.x && x <= r.x + r.w) return Number(listId);
    }
    return null;
  };

  const dragHandlers = {
    registerCard: (id) => (ref) => { cardRefs.current[id] = ref; },
    registerColumn: (id) => (ref) => { colRefs.current[id] = ref; },
    start: (card, x, y) => {
      measureAll();
      setDrag({ card, x, y });
    },
    move: (x, y) => {
      setDrag((d) => (d ? { ...d, x, y } : d));
      setHoverList(findColumnAt(x));
    },
    end: async (x, y) => {
      setHoverList(null);
      const current = dragState.current;
      setDrag(null);
      if (!current) return;
      const targetListId = findColumnAt(x);
      if (!targetListId) return;
      const b = boardRef.current;
      const list = b.lists.find((l) => l.id === targetListId);
      if (!list) return;

      const others = list.cards.filter((c) => c.id !== current.card.id);
      let idx = 0;
      for (const c of others) {
        const r = meta.current.cardRects[c.id];
        if (r && y > r.y + r.h / 2) idx++;
      }
      const prev = others[idx - 1];
      const next = others[idx];
      let position;
      if (prev && next) position = (prev.position + next.position) / 2;
      else if (prev) position = prev.position + 1000;
      else if (next) position = next.position - 1000;
      else position = 1000;

      // Update optimis agar UI langsung berpindah.
      setBoard((old) => {
        const copy = JSON.parse(JSON.stringify(old));
        let moved;
        for (const l of copy.lists) {
          const i = l.cards.findIndex((c) => c.id === current.card.id);
          if (i >= 0) [moved] = l.cards.splice(i, 1);
        }
        if (moved) {
          moved.list_id = targetListId;
          moved.position = position;
          const target = copy.lists.find((l) => l.id === targetListId);
          target.cards.push(moved);
          target.cards.sort((a, b2) => a.position - b2.position || a.id - b2.id);
        }
        return copy;
      });
      try {
        await api.updateCard(current.card.id, { list_id: targetListId, position });
      } catch {
        refetch();
      }
    },
    cancel: () => { setHoverList(null); setDrag(null); },
  };

  // Simpan drag terkini untuk dipakai di 'end' (state closure bisa basi).
  const dragState = useRef(null);
  dragState.current = drag;

  const addList = async () => {
    const n = newListName.trim();
    setAddingList(false);
    setNewListName('');
    if (!n) return;
    await api.createList({ board_id: BOARD_ID, name: n });
    refetch();
  };

  if (error) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={{ color: '#fff', fontSize: 16, marginBottom: 12 }}>
          Tidak bisa terhubung ke server: {error}
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={refetch}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Coba lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!board) {
    return (
      <View style={[s.root, s.center]}>
        <Text style={{ color: '#fff' }}>Memuat board...</Text>
      </View>
    );
  }

  const origin = meta.current.rootOrigin;

  return (
    <View style={s.root} ref={rootRef}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📦 {board.name}</Text>
        <View style={[s.dot, { backgroundColor: connected ? colors.ok : colors.danger }]} />
        <Text style={s.headerHint}>
          {connected ? 'realtime aktif' : 'offline'} · seret kartu lewat pegangan ⠿
        </Text>
      </View>

      <ScrollView horizontal scrollEnabled={!drag} contentContainerStyle={s.boardContent}>
        {board.lists.map((list) => (
          <Column
            key={list.id}
            list={list}
            onOpenCard={setOpenCard}
            dragHandlers={dragHandlers}
            dragging={drag}
            hovered={hoverList === list.id}
            onChanged={refetch}
          />
        ))}
        <View style={s.addListWrap}>
          {addingList ? (
            <TextInput
              style={s.addInput}
              placeholder="Nama kolom..."
              value={newListName}
              onChangeText={setNewListName}
              onSubmitEditing={addList}
              onBlur={addList}
              autoFocus
            />
          ) : (
            <TouchableOpacity style={s.addListBtn} onPress={() => setAddingList(true)}>
              <Text style={s.addBtnText}>＋ Tambah kolom</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {drag && (
        <View
          pointerEvents="none"
          style={[
            s.ghost,
            {
              left: drag.x - origin.x - COL_WIDTH / 2 + 20,
              top: drag.y - origin.y - 24,
              borderLeftColor: priorityColor(drag.card.priority),
            },
          ]}
        >
          <Text style={s.cardTitle}>{drag.card.title}</Text>
        </View>
      )}

      <CardModal card={openCard} onClose={() => setOpenCard(null)} onChanged={refetch} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.boardBg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.header,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerHint: { color: '#9fc3e8', fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  boardContent: { padding: 12, alignItems: 'flex-start' },
  column: {
    width: COL_WIDTH, backgroundColor: colors.column, borderRadius: 12,
    padding: 8, marginRight: 12, maxHeight: '100%',
  },
  colHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 6 },
  colTitle: { fontWeight: '800', color: colors.text, fontSize: 15 },
  colCount: { color: colors.subtle, fontWeight: '400' },
  colTitleInput: {
    flex: 1, borderWidth: 1, borderColor: colors.accent, borderRadius: 6,
    paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#fff',
  },
  colDelete: { color: colors.subtle, fontSize: 14, padding: 4 },
  card: {
    backgroundColor: colors.card, borderRadius: 8, padding: 10, marginBottom: 8,
    borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  cardTitle: { color: colors.text, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: {
    backgroundColor: '#ebecf0', color: colors.subtle, fontSize: 11,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  handle: {
    paddingHorizontal: 8, paddingVertical: 10, marginLeft: 4,
    ...(Platform.OS === 'web' ? { cursor: 'grab' } : {}),
  },
  handleText: { color: colors.subtle, fontSize: 16 },
  addBtn: { padding: 8, borderRadius: 8 },
  addBtnText: { color: colors.subtle, fontWeight: '700' },
  addInput: {
    backgroundColor: '#fff', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: colors.accent,
  },
  addListWrap: { width: 220 },
  addListBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: 12 },
  ghost: {
    position: 'absolute', width: COL_WIDTH - 40, backgroundColor: '#fff',
    borderRadius: 8, padding: 10, borderLeftWidth: 4, opacity: 0.92,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  retryBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
});
