// Shared component: PaginationBar + List (display logic)
import { useState, useRef } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme, shadow } from '../theme';
import { PackageRow, PackageTable } from '../components';
import { useBreakpoint } from '../responsive';
import { useS } from './styles';

const PAGE_SIZE = 50;

function PaginationControls({ page, total, pageSize, onPage }) {
  const s = useS();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <View style={s.pageCtrls}>
      <TouchableOpacity
        style={[s.pageBtn, page <= 1 && s.pageBtnDisabled]}
        disabled={page <= 1}
        onPress={() => onPage(page - 1)}
      >
        <Text style={[s.pageBtnText, page <= 1 && s.pageBtnTextDisabled]}>‹ Sebelumnya</Text>
      </TouchableOpacity>
      <Text style={s.pageNum}>Hal {page}/{pages}</Text>
      <TouchableOpacity
        style={[s.pageBtn, page >= pages && s.pageBtnDisabled]}
        disabled={page >= pages}
        onPress={() => onPage(page + 1)}
      >
        <Text style={[s.pageBtnText, page >= pages && s.pageBtnTextDisabled]}>Berikutnya ›</Text>
      </TouchableOpacity>
    </View>
  );
}

// Pagination bar penuh (desktop): dipasang di bawah list dalam alur normal.
export function PaginationBar({ page, total, pageSize, onPage }) {
  const s = useS();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <View style={s.pageBar}>
      <Text style={s.pageInfo}>{from}–{to} dari {total}</Text>
      <PaginationControls page={page} total={total} pageSize={pageSize} onPage={onPage} />
    </View>
  );
}

// Versi mengambang (mobile): muncul di atas navbar floating saat scroll mentok bawah.
function FloatingPagination({ page, total, pageSize, onPage }) {
  const { colors } = useTheme();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <View pointerEvents="box-none" style={styles.floatWrap}>
      <View style={[styles.floatPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <PaginationControls page={page} total={total} pageSize={pageSize} onPage={onPage} />
      </View>
    </View>
  );
}

export function PackageList({ items, loading, onOpen, rowAction, pagination, onSearchQuery, onColumnFilterChange, tab, selectedIds, onToggleSelect, onSelectAll, header }) {
  const { colors } = useTheme();
  const s = useS();
  const { isDesktop, isUltraWide } = useBreakpoint();
  const [atBottom, setAtBottom] = useState(true);
  const sizeRef = useRef({ viewH: 0, contentH: 0 });
  const yRef = useRef(0);

  if (loading && !items.length) return <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />;

  const evaluateBottom = () => {
    const { viewH, contentH } = sizeRef.current;
    if (!viewH || !contentH) return;
    const maxY = contentH - viewH;
    setAtBottom(maxY <= 0 || yRef.current >= maxY - 40);
  };

  const onListScroll = (e) => {
    yRef.current = e.nativeEvent.contentOffset.y;
    evaluateBottom();
  };

  const body = isDesktop ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isUltraWide ? 0 : 14, paddingBottom: 24 }}>
      {header}
      <PackageTable
        items={items}
        onPress={onOpen}
        renderAction={rowAction}
        onSearchQuery={onSearchQuery}
        onColumnFilterChange={onColumnFilterChange}
        tab={tab}
        selectedIds={selectedIds}
        onToggleSelect={onToggleSelect}
        onSelectAll={onSelectAll}
      />
    </ScrollView>
  ) : (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 80, flexGrow: 1 }}
      ListHeaderComponent={header}
      ListEmptyComponent={<Text style={s.empty}>Tidak ada paket.</Text>}
      renderItem={({ item }) => (
        <PackageRow pkg={item} onPress={onOpen} action={rowAction?.(item)} selected={selectedIds?.has(item.id)} onToggleSelect={onToggleSelect} />
      )}
      onScroll={onListScroll}
      scrollEventThrottle={16}
      onLayout={(e) => { sizeRef.current.viewH = e.nativeEvent.layout.height; evaluateBottom(); }}
      onContentSizeChange={(w, h) => { sizeRef.current.contentH = h; evaluateBottom(); }}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      {body}
      {pagination && isDesktop && <PaginationBar {...pagination} pageSize={PAGE_SIZE} />}
      {pagination && !isDesktop && atBottom && <FloatingPagination {...pagination} pageSize={PAGE_SIZE} />}
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 80,
    alignItems: 'center',
    zIndex: 30,
  },
  floatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    ...shadow.float,
  },
});