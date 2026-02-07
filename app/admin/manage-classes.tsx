import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ClassRow = {
  id: string;
  name: string;
  session_id: string | null;
  sessions?: { name: string }[] | null;
};

type SessionRow = { id: string; name: string };

export default function ManageClassesScreen() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const loadData = async (nextPage = page, term = search) => {
    const start = nextPage * pageSize;
    const end = start + pageSize - 1;
    let classQuery = supabase
      .from('classes')
      .select('id, name, session_id, sessions(name)', { count: 'exact' })
      .order('name', { ascending: true })
      .range(start, end);
    if (term.trim()) {
      classQuery = classQuery.ilike('name', `%${term.trim()}%`);
    }
    const { data: classRows, count } = await classQuery;
    const { data: sessionRows } = await supabase
      .from('sessions')
      .select('id, name')
      .eq('status', 'active')
      .order('start_date', { ascending: false });
    setClasses(classRows ?? []);
    setSessions(sessionRows ?? []);
    setTotal(count ?? 0);
    setPage(nextPage);
  };

  useEffect(() => {
    let active = true;
    const checkAccess = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const user = data.session?.user;
      if (!user) {
        router.replace('/auth/login' as any);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile || (profile.role !== 'admin' && profile.role !== 'staff')) {
        router.replace('/auth/login' as any);
        return;
      }
      await loadData();
      if (active) setAuthReady(true);
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  const handleSave = async (row: ClassRow) => {
    setStatus('');
    setError(null);
    const { error: updateError } = await supabase
      .from('classes')
      .update({ name: row.name, session_id: row.session_id })
      .eq('id', row.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setStatus('Class updated.');
      await loadData();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Class', 'Are you sure you want to delete this class?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setStatus('');
          setError(null);
          const { error: deleteError } = await supabase.from('classes').delete().eq('id', id);
          if (deleteError) {
            setError(deleteError.message);
          } else {
            setStatus('Class deleted.');
            await loadData();
          }
        },
      },
    ]);
  };

  if (!authReady) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Checking access...</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Manage Classes</Text>
      <Text style={styles.subtitle}>Edit or delete classes.</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search class"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => loadData(0, search)}>
          <Text style={styles.searchText}>Search</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      {classes.map((row) => (
        <View key={row.id} style={styles.card}>
          <TextInput
            style={styles.input}
            value={row.name}
            onChangeText={(value) =>
              setClasses((prev) => prev.map((item) => (item.id === row.id ? { ...item, name: value } : item)))
            }
          />
          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Session</Text>
            <Picker
              selectedValue={row.session_id ?? ''}
              onValueChange={(value) =>
                setClasses((prev) => prev.map((item) => (item.id === row.id ? { ...item, session_id: String(value) } : item)))
              }
            >
              <Picker.Item label="Select session" value="" />
              {sessions.map((session) => (
                <Picker.Item key={session.id} label={session.name} value={session.id} />
              ))}
            </Picker>
          </View>
          <View style={styles.row}>
            <TouchableOpacity style={styles.saveBtn} onPress={() => handleSave(row)}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(row.id)}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <View style={styles.paginationRow}>
        <TouchableOpacity
          style={[styles.pageBtn, page === 0 && styles.pageBtnDisabled]}
          onPress={() => loadData(Math.max(0, page - 1), search)}
          disabled={page === 0}
        >
          <Text style={styles.pageText}>Prev</Text>
        </TouchableOpacity>
        <Text style={styles.pageMeta}>
          Page {page + 1} of {Math.max(1, Math.ceil(total / pageSize))}
        </Text>
        <TouchableOpacity
          style={[styles.pageBtn, (page + 1) * pageSize >= total && styles.pageBtnDisabled]}
          onPress={() => loadData(page + 1, search)}
          disabled={(page + 1) * pageSize >= total}
        >
          <Text style={styles.pageText}>Next</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text },
  subtitle: { color: Colors.light.icon },
  card: { backgroundColor: Colors.light.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.light.border, gap: 8 },
  input: { backgroundColor: Colors.light.surfaceAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: Colors.light.border },
  row: { flexDirection: 'row', gap: 8 },
  saveBtn: { backgroundColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  deleteBtn: { backgroundColor: '#b3261e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  pickerWrap: { backgroundColor: Colors.light.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 6 },
  pickerLabel: { fontSize: 12, color: Colors.light.icon, marginTop: 8, marginLeft: 6, fontWeight: '600' },
  status: { color: Colors.light.accent, fontWeight: '600' },
  errorText: { color: '#b3261e', fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInput: { flex: 1 },
  searchBtn: { backgroundColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchText: { color: '#fff', fontWeight: '700' },
  paginationRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pageBtn: { backgroundColor: Colors.light.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border },
  pageBtnDisabled: { opacity: 0.5 },
  pageText: { color: Colors.light.text, fontWeight: '600' },
  pageMeta: { color: Colors.light.icon, fontWeight: '600' },
});
