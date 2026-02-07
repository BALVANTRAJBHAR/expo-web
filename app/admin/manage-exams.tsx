import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ExamRow = {
  id: string;
  exam_name: string;
  exam_date: string;
  class_id: string | null;
  is_upcoming: boolean;
  classes?: { name: string }[] | null;
};

type ClassRow = { id: string; name: string };

export default function ManageExamsScreen() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const loadData = async (nextPage = page, term = search) => {
    const start = nextPage * pageSize;
    const end = start + pageSize - 1;
    let examQuery = supabase
      .from('exams')
      .select('id, exam_name, exam_date, class_id, is_upcoming, classes(name)', { count: 'exact' })
      .order('exam_date', { ascending: true })
      .range(start, end);
    if (term.trim()) {
      examQuery = examQuery.ilike('exam_name', `%${term.trim()}%`);
    }
    const { data: examRows, count } = await examQuery;
    const { data: classRows } = await supabase
      .from('classes')
      .select('id, name')
      .eq('status', 'active')
      .order('name', { ascending: true });
    setExams(examRows ?? []);
    setClasses(classRows ?? []);
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

  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const handleSave = async (row: ExamRow) => {
    setStatus('');
    setError(null);
    const { error: updateError } = await supabase
      .from('exams')
      .update({
        exam_name: row.exam_name,
        exam_date: row.exam_date,
        class_id: row.class_id,
        is_upcoming: row.is_upcoming,
      })
      .eq('id', row.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setStatus('Exam updated.');
      await loadData();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Exam', 'Are you sure you want to delete this exam?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setStatus('');
          setError(null);
          const { error: deleteError } = await supabase.from('exams').delete().eq('id', id);
          if (deleteError) {
            setError(deleteError.message);
          } else {
            setStatus('Exam deleted.');
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
      <Text style={styles.title}>Manage Exams</Text>
      <Text style={styles.subtitle}>Edit or delete existing exams.</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search exam name"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => loadData(0, search)}>
          <Text style={styles.searchText}>Search</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      {exams.map((row) => (
        <View key={row.id} style={styles.card}>
          <TextInput
            style={styles.input}
            value={row.exam_name}
            onChangeText={(value) =>
              setExams((prev) => prev.map((item) => (item.id === row.id ? { ...item, exam_name: value } : item)))
            }
          />
          <TextInput
            style={styles.input}
            value={row.exam_date}
            onChangeText={(value) =>
              setExams((prev) => prev.map((item) => (item.id === row.id ? { ...item, exam_date: value } : item)))
            }
            placeholder="YYYY-MM-DDTHH:mm"
          />
          <Text style={styles.dateHint}>Current: {formatDateTime(row.exam_date)}</Text>

          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Class</Text>
            <Picker
              selectedValue={row.class_id ?? ''}
              onValueChange={(value) =>
                setExams((prev) => prev.map((item) => (item.id === row.id ? { ...item, class_id: String(value) } : item)))
              }
            >
              <Picker.Item label="Select class" value="" />
              {classes.map((item) => (
                <Picker.Item key={item.id} label={item.name} value={item.id} />
              ))}
            </Picker>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, row.is_upcoming && styles.chipActive]}
              onPress={() =>
                setExams((prev) => prev.map((item) => (item.id === row.id ? { ...item, is_upcoming: !item.is_upcoming } : item)))
              }
            >
              <Text style={styles.chipText}>{row.is_upcoming ? 'Upcoming' : 'Not Upcoming'}</Text>
            </TouchableOpacity>
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
  dateHint: { color: Colors.light.icon, fontSize: 12 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: Colors.light.surfaceAlt, borderWidth: 1, borderColor: Colors.light.border },
  chipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  chipText: { color: Colors.light.text, fontWeight: '600', fontSize: 12 },
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
