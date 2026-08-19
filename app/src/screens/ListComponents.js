// Shared component: PaginationBar + List (display logic)
import { useState } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { PackageRow, PackageTable, NamePickerModal } from '../components';
import { useBreakpoint } from '../responsive';
import { s } from './styles';

const PAGE_SIZE = 50;

export function PaginationBar({ page, total, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <View style={s.pageBar}>
      <Text style={s.pageInfo}>{from}–{to} dari {total}</Text>
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
    </View>
  );
}

export function PackageList({ items, loading, onOpen, rowAction, pagination, onSearchQuery, onColumnFilterChange, tab, selectedIds, onToggleSelect, onSelectAll, userRole, onChanged }) {
  const { isDesktop, isUltraWide } = useBreakpoint();
  const [tagPkg, setTagPkg] = useState(null);
  if (loading && !items.length) return <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />;

  const body = isDesktop ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: isUltraWide ? 0 : 14, paddingBottom: 24 }}>
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
        userRole={userRole}
        onTagPress={setTagPkg}
      />
    </ScrollView>
  ) : (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 24, flexGrow: 1 }}
      ListEmptyComponent={<Text style={s.empty}>Tidak ada paket.</Text>}
      renderItem={({ item }) => (
        <PackageRow pkg={item} onPress={onOpen} action={rowAction?.(item)} selected={selectedIds?.has(item.id)} onToggleSelect={onToggleSelect} userRole={userRole} onTagPress={setTagPkg} />
      )}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      {body}
      {pagination && <PaginationBar {...pagination} pageSize={PAGE_SIZE} />}
      <NamePickerModal
        visible={!!tagPkg}
        pkg={tagPkg}
        userRole={userRole}
        onClose={() => setTagPkg(null)}
        onChanged={onChanged}
      />
    </View>
  );
}
