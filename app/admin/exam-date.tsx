import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function ExamDateScreen() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [dateValue, setDateValue] = useState<Date>(new Date());
  const [activeSessions, setActiveSessions] = useState<{ id: string; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [existingExamId, setExistingExamId] = useState<string>('');
  const [form, setForm] = useState({
    exam_name: '',
    exam_date: '',
    session: '',
    class_name: '',
  });

  const formattedDate = useMemo(() => {
    if (!form.exam_date) return '';
    const date = new Date(form.exam_date);
    if (Number.isNaN(date.getTime())) return form.exam_date;
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }, [form.exam_date]);

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
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: false });
      const { data: classRows } = await supabase
        .from('classes')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });
      if (active) {
        setActiveSessions(sessions ?? []);
        setClasses(classRows ?? []);
        const defaultSession = sessions?.[0]?.name ?? '';
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

  const handleSave = async () => {
    if (!form.exam_name || !form.exam_date || !form.class_name) {
      setError('Exam name, date, class required.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus('');

    try {
      const sessionId = await resolveSession(form.session.trim());
      const classId = await resolveClass(form.class_name.trim(), sessionId);

      const { data: existing } = await supabase
        .from('exams')
        .select('id')
        .eq('exam_name', form.exam_name.trim())
        .eq('exam_date', form.exam_date.trim())
        .limit(1)
        .maybeSingle();

      if (!existingExamId && existing) {
        setError('Same exam date already exists.');
        setSaving(false);
        return;
      }

      const payload = {
        exam_name: form.exam_name.trim(),
        exam_date: form.exam_date.trim(),
        class_id: classId,
        is_upcoming: (() => {
          const parsed = new Date(form.exam_date.trim()).getTime();
          if (Number.isNaN(parsed)) return true;
          return parsed >= Date.now();
        })(),
      };

      const { error: insertError } = existingExamId
        ? await supabase.from('exams').update(payload).eq('id', existingExamId)
        : await supabase.from('exams').insert({ ...payload, status: 'active' });

      if (insertError) {
        setError(insertError.message);
      } else {
        setStatus(existingExamId ? 'Exam updated successfully.' : 'Exam date saved successfully.');
        setExistingExamId('');
        setSelectedClassId('');
        setForm((prev) => ({ ...prev, exam_name: '', exam_date: '' }));
      }
    } catch (err) {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async () => {
    const term = form.exam_name.trim();
    if (!term) {
      setError('Exam name required for search.');
      return;
    }
    setError(null);
    setStatus('Searching...');

    let query = supabase
      .from('exams')
      .select('id, exam_name, exam_date, class_id')
      .ilike('exam_name', `%${term}%`)
      .order('exam_date', { ascending: false })
      .limit(1);

    const dateTerm = form.exam_date.trim();
    if (dateTerm) {
      query = query.eq('exam_date', dateTerm);
    }

    const { data, error: searchError } = await query.maybeSingle();
    if (searchError) {
      setStatus('');
      setError(searchError.message);
      return;
    }
    if (!data) {
      setExistingExamId('');
      setStatus('No exam found.');
      return;
    }

    setExistingExamId(data.id);
    setForm((prev) => ({
      ...prev,
      exam_name: data.exam_name ?? prev.exam_name,
      exam_date: data.exam_date ?? prev.exam_date,
    }));
    setSelectedClassId(data.class_id ?? '');
    setStatus('Exam loaded. You can update or delete.');
  };

  const handleDelete = async () => {
    if (!existingExamId) {
      setError('Search and load an exam first.');
      return;
    }
    Alert.alert('Delete Exam', 'Are you sure you want to delete this exam?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          setError(null);
          setStatus('');
          const { error: deleteError } = await supabase.from('exams').delete().eq('id', existingExamId);
          if (deleteError) {
            setError(deleteError.message);
          } else {
            setStatus('Exam deleted successfully.');
            setExistingExamId('');
            setSelectedClassId('');
            setForm((prev) => ({ ...prev, exam_name: '', exam_date: '' }));
          }
          setSaving(false);
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
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Add Exam Date</Text>
          <Text style={styles.subtitle}>Admin/Staff can add exam schedule.</Text>
        </View>
      </View>

      <View style={styles.formWrap}>
        <TextInput
          placeholder="Exam Name"
          style={styles.input}
          value={form.exam_name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, exam_name: value }))}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <View style={styles.dateRow}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Exam Date & Time</Text>
            <Text style={styles.dateValue}>{formattedDate || 'Select date & time'}</Text>
          </View>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.dateBtnText}>Pick</Text>
          </TouchableOpacity>
        </View>
        {Platform.OS === 'web' ? (
          <TextInput
            placeholder="YYYY-MM-DD HH:mm"
            style={styles.input}
            value={form.exam_date}
            onChangeText={(value) => setForm((prev) => ({ ...prev, exam_date: value }))}
          />
        ) : null}
        {showPicker && Platform.OS !== 'web' ? (
          <DateTimePicker
            mode="datetime"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            value={dateValue}
            onChange={(_, selected) => {
              setShowPicker(false);
              if (selected) {
                setDateValue(selected);
                setForm((prev) => ({ ...prev, exam_date: selected.toISOString() }));
              }
            }}
          />
        ) : null}
        <TextInput
          placeholder="Session (e.g. 2026)"
          style={styles.input}
          value={form.session}
          onChangeText={(value) => setForm((prev) => ({ ...prev, session: value }))}
        />
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerLabel}>Class Name</Text>
          <Picker selectedValue={selectedClassId} onValueChange={(value) => setSelectedClassId(String(value))}>
            <Picker.Item label="Select class" value="" />
            {classes.map((item) => (
              <Picker.Item key={item.id} label={item.name} value={item.id} />
            ))}
          </Picker>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={saving}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cta, styles.ctaInline]} onPress={handleSave} disabled={saving}>
            <Text style={styles.ctaText}>{saving ? 'Saving...' : existingExamId ? 'Update' : 'Save Exam Date'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, !existingExamId && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={saving || !existingExamId}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {activeSessions.length ? (
          <Text style={styles.sessionHint}>Active session default: {activeSessions[0]?.name}</Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        
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
  input: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
    fontFamily: 'Times New Roman',
  },
  dateRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dateBox: { flex: 1, backgroundColor: Colors.light.surfaceAlt, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.light.border },
  dateLabel: { fontSize: 12, color: Colors.light.icon, marginBottom: 6, fontWeight: '600', fontFamily: 'Times New Roman' },
  dateValue: { color: Colors.light.text, fontWeight: '600', fontFamily: 'Times New Roman' },
  dateBtn: { backgroundColor: Colors.light.tint, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  dateBtnText: { color: '#fff', fontWeight: '700', fontFamily: 'Times New Roman' },
  sessionHint: { color: Colors.light.icon, fontSize: 12, fontFamily: 'Times New Roman' },
  pickerWrap: { backgroundColor: Colors.light.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 6 },
  pickerLabel: { fontSize: 12, color: Colors.light.icon, marginTop: 8, marginLeft: 6, fontWeight: '600', fontFamily: 'Times New Roman' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 },
  searchBtn: { borderWidth: 1, borderColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  searchBtnText: { color: Colors.light.tint, fontWeight: '700', fontSize: 12, fontFamily: 'Times New Roman' },
  cta: { backgroundColor: Colors.light.tint, padding: 12, borderRadius: 12, alignItems: 'center' },
  ctaInline: { flex: 1 },
  ctaText: { color: '#fff', fontWeight: '700', fontFamily: 'Times New Roman' },
  deleteBtn: { backgroundColor: '#b3261e', paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  deleteBtnDisabled: { opacity: 0.4 },
  deleteText: { color: '#fff', fontWeight: '700', fontSize: 12, fontFamily: 'Times New Roman' },
  status: { color: Colors.light.accent, fontWeight: '600', fontFamily: 'Times New Roman' },
  errorText: { color: '#b3261e', fontWeight: '600', fontFamily: 'Times New Roman' },
});
