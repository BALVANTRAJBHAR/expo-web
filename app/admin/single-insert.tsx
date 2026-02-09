import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const statusOptions = ['pass', 'fail', 'absent'];
const resultOptions = ['published', 'draft'];

export default function SingleInsertScreen() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [studentsMsg, setStudentsMsg] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [exams, setExams] = useState<{ id: string; exam_name: string; exam_date: string; class_id: string | null; classes?: { name: string }[] | null }[]>([]);
  const [savedResults, setSavedResults] = useState<
    { id: string; roll_no: string; registration_no: string | null; student_name: string; marks: number | null; status_text: string }[]
  >([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [existingResultId, setExistingResultId] = useState<string>('');

  const [form, setForm] = useState({
    exam_name: '',
    exam_date: '',
    session: '',
    class_name: '',
    roll_no: '',
    registration_no: '',
    student_name: '',
    dob: '',
    marks: '',
    status_text: 'pass',
    result_status: 'published',
  });

  const canSubmit = useMemo(() => {
    return !!form.exam_name && !!form.exam_date && !!form.class_name && !!form.roll_no && !!form.student_name;
  }, [form]);

  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
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

      const { data: sessionRows } = await supabase
        .from('sessions')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: false });
      const { data: classRows } = await supabase
        .from('classes')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });
      const { data: examRows } = await supabase
        .from('exams')
        .select('id, exam_name, exam_date, class_id, classes(name)')
        .eq('status', 'active')
        .order('exam_date', { ascending: true });

      const { data: recentResults } = await supabase
        .from('results')
        .select('id, roll_no, registration_no, student_name, marks, status_text')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(15);

      setSessions(sessionRows ?? []);
      setClasses(classRows ?? []);
      setExams(examRows ?? []);
      setSavedResults(recentResults ?? []);
      const defaultSession = sessionRows?.[0]?.name ?? '';
      if (defaultSession) {
        setForm((prev) => ({ ...prev, session: prev.session || defaultSession }));
      }
      setAuthReady(true);
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (selectedClassId) {
      const selected = classes.find((item) => item.id === selectedClassId);
      if (selected) setForm((prev) => ({ ...prev, class_name: selected.name }));
    }
  }, [selectedClassId, classes]);

  useEffect(() => {
    if (selectedExamId) {
      const selected = exams.find((item) => item.id === selectedExamId);
      if (selected) {
        setForm((prev) => ({
          ...prev,
          exam_name: selected.exam_name,
          exam_date: selected.exam_date,
          class_name: selected.classes?.[0]?.name ?? prev.class_name,
        }));
        if (selected.class_id) setSelectedClassId(selected.class_id);
      }
    }
  }, [selectedExamId, exams]);

  const resolveSession = async (name: string) => {
    if (!name) return null;
    const { data: session } = await supabase.from('sessions').select('id').eq('name', name).maybeSingle();
    if (session?.id) return session.id;
    const { data: inserted } = await supabase
      .from('sessions')
      .insert({ name, status: 'active' })
      .select('id')
      .single();
    return inserted?.id ?? null;
  };

  const resolveClass = async (name: string, sessionId: string | null) => {
    if (!name) return null;
    const { data: classRow } = await supabase.from('classes').select('id').eq('name', name).maybeSingle();
    if (classRow?.id) return classRow.id;
    const { data: inserted } = await supabase
      .from('classes')
      .insert({ name, session_id: sessionId, status: 'active' })
      .select('id')
      .single();
    return inserted?.id ?? null;
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Exam, date, class, roll no, student name required.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus('');

    try {
      const sessionId = await resolveSession(form.session.trim());
      const classId = await resolveClass(form.class_name.trim(), sessionId);
      const examId = selectedExamId;

      if (!examId) {
        setError('Please select exam from list.');
        setSaving(false);
        return;
      }

      const { data: existing } = await supabase
        .from('results')
        .select('id')
        .eq('exam_id', examId)
        .eq('roll_no', form.roll_no.trim())
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();

      if (!existingResultId && existing) {
        setError('Same exam + roll number already exists.');
        setSaving(false);
        return;
      }

      const payload = {
        exam_id: examId,
        roll_no: form.roll_no.trim(),
        registration_no: form.registration_no.trim() || null,
        student_name: form.student_name.trim(),
        dob: form.dob.trim() || null,
        marks: form.marks ? Number(form.marks) : null,
        status_text: form.status_text,
        result_status: form.result_status,
      };

      const { error: insertError } = existingResultId
        ? await supabase.from('results').update(payload).eq('id', existingResultId)
        : await supabase.from('results').insert({ ...payload, status: 'active' });

      if (insertError) {
        setError(insertError.message);
      } else {
        setStatus(existingResultId ? 'Result updated successfully.' : 'Result saved successfully.');
        setExistingResultId('');
        const { data: recentResults } = await supabase
          .from('results')
          .select('id, roll_no, registration_no, student_name, marks, status_text')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(15);
        setSavedResults(recentResults ?? []);
      }
    } catch (err) {
      setError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleResultSearch = async () => {
    if (!selectedExamId) {
      setError('Please select exam first.');
      return;
    }
    const roll = form.roll_no.trim();
    if (!roll) {
      setError('Roll No required for search.');
      return;
    }

    setError(null);
    setStatus('Searching...');
    const { data, error: searchError } = await supabase
      .from('results')
      .select('id, roll_no, registration_no, student_name, dob, marks, status_text, result_status')
      .eq('exam_id', selectedExamId)
      .eq('roll_no', roll)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (searchError) {
      setStatus('');
      setError(searchError.message);
      return;
    }
    if (!data) {
      setExistingResultId('');
      setStatus('No result found for this exam + roll no.');
      return;
    }

    setExistingResultId(data.id);
    setForm((prev) => ({
      ...prev,
      roll_no: data.roll_no ?? prev.roll_no,
      registration_no: data.registration_no ?? prev.registration_no,
      student_name: data.student_name ?? prev.student_name,
      dob: data.dob ?? prev.dob,
      marks: data.marks === null || data.marks === undefined ? prev.marks : String(data.marks),
      status_text: data.status_text ?? prev.status_text,
      result_status: data.result_status ?? prev.result_status,
    }));
    setStatus('Result loaded. You can update or delete.');
  };

  const handleResultDelete = async () => {
    if (!existingResultId) {
      setError('Search and load a result first.');
      return;
    }

    const runDelete = async () => {
      setSaving(true);
      setError(null);
      setStatus('');
      const { error: deleteError } = await supabase
        .from('results')
        .update({ status: 'inactive' })
        .eq('id', existingResultId);
      if (deleteError) {
        setError(deleteError.message);
      } else {
        setStatus('Result removed successfully.');
        setExistingResultId('');
        const { data: recentResults } = await supabase
          .from('results')
          .select('id, roll_no, registration_no, student_name, marks, status_text')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(15);
        setSavedResults(recentResults ?? []);
      }
      setSaving(false);
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to delete this result?') : false;
      if (!ok) return;
      await runDelete();
      return;
    }

    Alert.alert('Delete Result', 'Are you sure you want to delete this result?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          runDelete();
        },
      },
    ]);
  };

  const handleStudentSearch = async () => {
    const term = searchTerm.trim();
    if (!term) {
      setStudentsMsg('Search term required.');
      return;
    }

    setStudentsMsg('Searching...');
    try {
      const { data, error: searchError } = await supabase
        .from('students')
        .select('full_name, registration_no, roll_no, dob, mobile, class_id')
        .or(`registration_no.eq.${term},full_name.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (searchError) {
        setStudentsMsg(`Search failed: ${searchError.message}`);
        return;
      }

      if (!data) {
        setStudentsMsg('No student found.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        registration_no: data.registration_no ?? prev.registration_no,
        roll_no: data.roll_no ?? prev.roll_no,
        student_name: data.full_name ?? prev.student_name,
        dob: data.dob ?? prev.dob,
      }));

      if (data.class_id) setSelectedClassId(data.class_id);
      setStudentsMsg('Student found and filled.');
    } catch {
      setStudentsMsg('Search failed.');
    }
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
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Single Result Entry</Text>
          <Text style={styles.subtitle}>Fill details and save result.</Text>
        </View>
      </View>

      <View style={styles.formWrap}>
        <View style={styles.searchBox}>
          <Text style={styles.searchLabel}>Search Student (Reg No / Name)</Text>
          <View style={styles.searchRow}>
            <TextInput
              placeholder="Enter registration no or name"
              style={[styles.input, styles.searchInput]}
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
              onSubmitEditing={handleStudentSearch}
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleStudentSearch}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
          {studentsMsg ? <Text style={styles.status}>{studentsMsg}</Text> : null}
        </View>

        <View style={styles.grid}>
          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Session</Text>
            <Picker
              selectedValue={form.session}
              onValueChange={(value) => setForm((prev) => ({ ...prev, session: String(value) }))}
            >
              <Picker.Item label="Select session" value="" />
              {sessions.map((item) => (
                <Picker.Item key={item.id} label={item.name} value={item.name} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Class Name</Text>
            <Picker selectedValue={selectedClassId} onValueChange={(value) => setSelectedClassId(String(value))}>
              <Picker.Item label="Select class" value="" />
              {classes.map((item) => (
                <Picker.Item key={item.id} label={item.name} value={item.id} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrap}>
            <Text style={styles.pickerLabel}>Exam Name / Date</Text>
            <Picker selectedValue={selectedExamId} onValueChange={(value) => setSelectedExamId(String(value))}>
              <Picker.Item label="Select exam" value="" />
              {exams.map((exam) => (
                <Picker.Item
                  key={exam.id}
                  label={`${exam.exam_name} • ${formatDateTime(exam.exam_date)}`}
                  value={exam.id}
                />
              ))}
            </Picker>
          </View>

          {selectedExamId ? <Text style={styles.examHint}>Selected: {formatDateTime(form.exam_date)}</Text> : null}

          <TextInput
            placeholder="Roll No"
            style={styles.input}
            value={form.roll_no}
            onChangeText={(value) => setForm((prev) => ({ ...prev, roll_no: value }))}
            returnKeyType="search"
            onSubmitEditing={handleResultSearch}
          />
          <TextInput
            placeholder="Registration No"
            style={styles.input}
            value={form.registration_no}
            onChangeText={(value) => setForm((prev) => ({ ...prev, registration_no: value }))}
          />
          <TextInput
            placeholder="Student Name"
            style={styles.input}
            value={form.student_name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, student_name: value }))}
          />
          <TextInput
            placeholder="DOB (YYYY-MM-DD)"
            style={styles.input}
            value={form.dob}
            onChangeText={(value) => setForm((prev) => ({ ...prev, dob: value }))}
          />
          <TextInput
            placeholder="Marks"
            style={styles.input}
            keyboardType="numeric"
            value={form.marks}
            onChangeText={(value) => setForm((prev) => ({ ...prev, marks: value }))}
          />
        <View style={styles.selectRow}>
          {statusOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.selectChip, form.status_text === option && styles.selectChipActive]}
              onPress={() => setForm((prev) => ({ ...prev, status_text: option }))}
            >
              <Text style={styles.selectChipText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.selectRow}>
          {resultOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.selectChip, form.result_status === option && styles.selectChipActive]}
              onPress={() => setForm((prev) => ({ ...prev, result_status: option }))}
            >
              <Text style={styles.selectChipText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.resultSearchBtn} onPress={handleResultSearch} disabled={saving}>
            <Text style={styles.resultSearchBtnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cta, styles.ctaInline]} onPress={handleSubmit} disabled={saving}>
            <Text style={styles.ctaText}>{saving ? 'Saving...' : existingResultId ? 'Update' : 'Save Result'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, !existingResultId && styles.deleteBtnDisabled]}
            onPress={handleResultDelete}
            disabled={saving || !existingResultId}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        {savedResults.length ? (
          <View style={styles.savedWrap}>
            <Text style={styles.savedTitle}>Saved Results (Newest First)</Text>
            <View style={styles.savedHeaderRow}>
              <Text style={[styles.savedCell, styles.savedHeaderCell]}>Student</Text>
              <Text style={[styles.savedCell, styles.savedHeaderCell]}>Roll</Text>
              <Text style={[styles.savedCell, styles.savedHeaderCell]}>Marks</Text>
            </View>
            {savedResults.map((row) => (
              <View key={row.id} style={styles.savedRow}>
                <Text style={styles.savedCell}>{row.student_name}</Text>
                <Text style={styles.savedCell}>{row.roll_no}</Text>
                <Text style={styles.savedCell}>{row.marks ?? '-'}</Text>
              </View>
            ))}
          </View>
        ) : null}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTextWrap: { flex: 1, alignItems: 'center' },
  backBtn: { borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.light.surface },
  backBtnText: { color: Colors.light.text, fontWeight: '700', fontFamily: 'Times New Roman' },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text, textAlign: 'center', fontFamily: 'Times New Roman' },
  subtitle: { color: Colors.light.icon, textAlign: 'center', fontFamily: 'Times New Roman' },
  formWrap: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    alignSelf: 'center',
    gap: 12,
  },
  grid: { gap: 10 },
  input: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    fontFamily: 'Times New Roman',
  },
  searchBox: { backgroundColor: Colors.light.surfaceAlt, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  searchLabel: { fontSize: 12, color: Colors.light.icon, marginBottom: 6, fontWeight: '600', fontFamily: 'Times New Roman' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchInput: { flex: 1 },
  searchBtn: { backgroundColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 12, fontFamily: 'Times New Roman' },
  pickerWrap: { backgroundColor: Colors.light.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 6 },
  pickerLabel: { fontSize: 12, color: Colors.light.icon, marginTop: 8, marginLeft: 6, fontWeight: '600', fontFamily: 'Times New Roman' },
  examHint: { color: Colors.light.icon, fontSize: 12, fontFamily: 'Times New Roman' },
  selectRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  selectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  selectChipActive: { backgroundColor: Colors.light.tint, borderColor: Colors.light.tint },
  selectChipText: { color: Colors.light.text, fontSize: 12, fontWeight: '600', fontFamily: 'Times New Roman' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  resultSearchBtn: { borderWidth: 1, borderColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  resultSearchBtnText: { color: Colors.light.tint, fontWeight: '700', fontSize: 12, fontFamily: 'Times New Roman' },
  cta: { backgroundColor: Colors.light.tint, padding: 12, borderRadius: 12, alignItems: 'center' },
  ctaInline: { flex: 1 },
  ctaText: { color: '#fff', fontWeight: '700', fontFamily: 'Times New Roman' },
  deleteBtn: { backgroundColor: '#b3261e', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 12, fontFamily: 'Times New Roman' },
  status: { color: Colors.light.accent, fontWeight: '600', fontFamily: 'Times New Roman' },
  errorText: { color: '#b3261e', fontWeight: '600', fontFamily: 'Times New Roman' },
  savedWrap: {
    marginTop: 10,
    width: '100%',
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  savedTitle: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    fontWeight: '700',
    color: Colors.light.text,
    fontFamily: 'Times New Roman',
  },
  savedHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.light.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  savedRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  savedCell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.light.text,
    fontFamily: 'Times New Roman',
  },
  savedHeaderCell: {
    fontWeight: '700',
    color: Colors.light.icon,
  },
});
