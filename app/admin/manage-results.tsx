import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ResultRow = {
  id: string;
  roll_no: string;
  registration_no: string | null;
  student_name: string;
  marks: number | null;
  status_text: string;
  result_status: string;
  exam_id: string | null;
  exams?: { exam_name: string }[] | null;
};

type ExamOption = { id: string; exam_name: string };

export default function ManageResultsScreen() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const loadData = async (nextPage = page, term = search) => {
    const start = nextPage * pageSize;
    const end = start + pageSize - 1;
    const { data: examRows } = await supabase
      .from('exams')
      .select('id, exam_name')
      .eq('status', 'active')
      .order('exam_name', { ascending: true });
    let resultQuery = supabase
      .from('results')
      .select('id, roll_no, registration_no, student_name, marks, status_text, result_status, exam_id, exams(exam_name)', {
        count: 'exact',
      })
      .order('created_at', { ascending: false })
      .range(start, end);
    if (term.trim()) {
      resultQuery = resultQuery.or(
        `student_name.ilike.%${term.trim()}%,registration_no.ilike.%${term.trim()}%,roll_no.ilike.%${term.trim()}%`
      );
    }
    const { data: resultRows, count } = await resultQuery;
    setExams(examRows ?? []);
    setResults(resultRows ?? []);
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

  const handleSave = async (row: ResultRow) => {
    setStatus('');
    setError(null);
    const { error: updateError } = await supabase
      .from('results')
      .update({
        roll_no: row.roll_no,
        registration_no: row.registration_no,
        student_name: row.student_name,
        marks: row.marks,
        status_text: row.status_text,
        result_status: row.result_status,
        exam_id: row.exam_id,
      })
      .eq('id', row.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setStatus('Result updated.');
      await loadData();
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Result', 'Are you sure you want to delete this result?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setStatus('');
          setError(null);
          const { error: deleteError } = await supabase.from('results').delete().eq('id', id);
          if (deleteError) {
            setError(deleteError.message);
          } else {
            setStatus('Result deleted.');
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
      <Text style={styles.title}>Manage Results</Text>
      <Text style={styles.subtitle}>Edit or delete results.</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, reg no, roll"
        />
        <TouchableOpacity style={styles.searchBtn} onPress={() => loadData(0, search)}>
          <Text style={styles.searchText}>Search</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}

      {results.map((row) => (
        <View key={row.id} style={styles.card}>
          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Exam</Text>
            <Picker
              selectedValue={row.exam_id ?? ''}
              onValueChange={(value) =>
                setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, exam_id: String(value) } : item)))
              }
            >
              <Picker.Item label="Select exam" value="" />
              {exams.map((exam) => (
                <Picker.Item key={exam.id} label={exam.exam_name} value={exam.id} />
              ))}
            </Picker>
          </View>
          <TextInput
            style={styles.input}
            value={row.roll_no}
            onChangeText={(value) =>
              setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, roll_no: value } : item)))
            }
          />
          <TextInput
            style={styles.input}
            value={row.registration_no ?? ''}
            onChangeText={(value) =>
              setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, registration_no: value } : item)))
            }
          />
          <TextInput
            style={styles.input}
            value={row.student_name}
            onChangeText={(value) =>
              setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, student_name: value } : item)))
            }
          />
          <TextInput
            style={styles.input}
            value={row.marks?.toString() ?? ''}
            keyboardType="numeric"
            onChangeText={(value) =>
              setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, marks: value ? Number(value) : null } : item)))
            }
          />
          <View style={styles.row}>
            {['pass', 'fail', 'absent'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, row.status_text === option && styles.chipActive]}
                onPress={() =>
                  setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, status_text: option } : item)))
                }
              >
                <Text style={styles.chipText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.row}>
            {['published', 'draft'].map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, row.result_status === option && styles.chipActive]}
                onPress={() =>
                  setResults((prev) => prev.map((item) => (item.id === row.id ? { ...item, result_status: option } : item)))
                }
              >
                <Text style={styles.chipText}>{option}</Text>
              </TouchableOpacity>
            ))}
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
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
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
