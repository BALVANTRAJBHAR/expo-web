import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function ClassAddScreen() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [className, setClassName] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [existingClassId, setExistingClassId] = useState<string>('');
  const [savedClasses, setSavedClasses] = useState<{ id: string; name: string; session_id: string | null }[]>([]);

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

      const { data: recentClasses } = await supabase
        .from('classes')
        .select('id, name, session_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(15);

      if (active) {
        setSessions(sessionRows ?? []);
        setSelectedSessionId(sessionRows?.[0]?.id ?? '');
        setSavedClasses(recentClasses ?? []);
      }
      setAuthReady(true);
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  const handleSave = async () => {
    if (!className.trim()) {
      setError('Class name required.');
      return;
    }

    setSaving(true);
    setError(null);
    setStatus('');

    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('name', className.trim())
      .maybeSingle();

    const { error: insertError } = existingClassId || existing?.id
      ? await supabase
          .from('classes')
          .update({ name: className.trim(), session_id: selectedSessionId || null })
          .eq('id', existingClassId || existing?.id)
      : await supabase.from('classes').insert({
          name: className.trim(),
          session_id: selectedSessionId || null,
          status: 'active',
        });

    if (insertError) {
      setError(insertError.message);
    } else {
      setStatus(existingClassId || existing?.id ? 'Class updated successfully.' : 'Class saved successfully.');
      setExistingClassId('');
      setClassName('');
      const { data: recentClasses } = await supabase
        .from('classes')
        .select('id, name, session_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(15);
      setSavedClasses(recentClasses ?? []);
    }
    setSaving(false);
  };

  const handleSearch = async () => {
    const term = className.trim();
    if (!term) {
      setError('Class name required for search.');
      return;
    }
    setError(null);
    setStatus('Searching...');
    const { data, error: searchError } = await supabase
      .from('classes')
      .select('id, name, session_id')
      .ilike('name', `%${term}%`)
      .order('name', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (searchError) {
      setStatus('');
      setError(searchError.message);
      return;
    }
    if (!data) {
      setExistingClassId('');
      setStatus('No class found.');
      return;
    }
    setExistingClassId(data.id);
    setClassName(data.name);
    setSelectedSessionId(data.session_id ?? '');
    setStatus('Class loaded. You can update or delete.');
  };

  const handleDelete = async () => {
    if (!existingClassId) {
      setError('Search and load a class first.');
      return;
    }

    const runDelete = async () => {
      setSaving(true);
      setError(null);
      setStatus('');
      const { error: deleteError } = await supabase
        .from('classes')
        .update({ status: 'inactive' })
        .eq('id', existingClassId);
      if (deleteError) {
        setError(deleteError.message);
      } else {
        setStatus('Class removed successfully.');
        setExistingClassId('');
        setClassName('');
        const { data: recentClasses } = await supabase
          .from('classes')
          .select('id, name, session_id')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(15);
        setSavedClasses(recentClasses ?? []);
      }
      setSaving(false);
    };

    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to delete this class?') : false;
      if (!ok) return;
      await runDelete();
      return;
    }

    Alert.alert('Delete Class', 'Are you sure you want to delete this class?', [
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
          <Text style={styles.title}>Add Class</Text>
          <Text style={styles.subtitle}>Admin/Staff can add classes.</Text>
        </View>
      </View>

      <View style={styles.formWrap}>
        <View style={styles.pickerWrap}>
          <Text style={styles.pickerLabel}>Session</Text>
          <Picker selectedValue={selectedSessionId} onValueChange={(value) => setSelectedSessionId(String(value))}>
            <Picker.Item label="Select session" value="" />
            {sessions.map((item) => (
              <Picker.Item key={item.id} label={item.name} value={item.id} />
            ))}
          </Picker>
        </View>

        <TextInput
          placeholder="Class Name"
          style={styles.input}
          value={className}
          onChangeText={(value) => {
            setClassName(value);
            if (!value.trim()) setExistingClassId('');
          }}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={saving}>
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cta, styles.ctaInline]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.ctaText}>{saving ? 'Saving...' : existingClassId ? 'Update' : 'Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.deleteBtn, !existingClassId && styles.deleteBtnDisabled]}
            onPress={handleDelete}
            disabled={saving || !existingClassId}
          >
            <Text style={styles.deleteText}>Delete</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}

        {savedClasses.length ? (
          <View style={styles.savedWrap}>
            <Text style={styles.savedTitle}>Saved Classes (Newest First)</Text>
            <View style={styles.savedHeaderRow}>
              <Text style={[styles.savedCell, styles.savedHeaderCell]}>Class</Text>
              <Text style={[styles.savedCell, styles.savedHeaderCell]}>Session</Text>
            </View>
            {savedClasses.map((row) => (
              <View key={row.id} style={styles.savedRow}>
                <Text style={styles.savedCell}>{row.name}</Text>
                <Text style={styles.savedCell}>{sessions.find((s) => s.id === row.session_id)?.name ?? '-'}</Text>
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
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text, fontFamily: 'Times New Roman', textAlign: 'center' },
  subtitle: { color: Colors.light.icon, fontFamily: 'Times New Roman', textAlign: 'center' },
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
  pickerWrap: { backgroundColor: Colors.light.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 6 },
  pickerLabel: { fontSize: 12, color: Colors.light.icon, marginTop: 8, marginLeft: 6, fontWeight: '600', fontFamily: 'Times New Roman' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
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
