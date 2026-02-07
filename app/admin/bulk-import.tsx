import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const requiredColumns = [
  'exam_name',
  'exam_date',
  'session',
  'class_name',
  'roll_no',
  'registration_no',
  'student_name',
  'dob',
  'mobile',
  'marks',
  'status_text',
  'result_status',
];

const sampleRows = [
  {
    exam_name: 'GK 2026',
    exam_date: '2026-02-08',
    session: '2026',
    class_name: 'Class 5',
    roll_no: '501',
    registration_no: '202605000001',
    student_name: 'Amit Kumar',
    dob: '2014-06-12',
    mobile: '9876543210',
    marks: 78,
    status_text: 'pass',
    result_status: 'published',
  },
  {
    exam_name: 'GK 2026',
    exam_date: '2026-02-08',
    session: '2026',
    class_name: 'Class 5',
    roll_no: '502',
    registration_no: '202605000002',
    student_name: 'Riya Singh',
    dob: '2013-11-03',
    mobile: '9876543211',
    marks: 66,
    status_text: 'pass',
    result_status: 'published',
  },
  {
    exam_name: 'GK 2026',
    exam_date: '2026-02-08',
    session: '2026',
    class_name: 'Class 6',
    roll_no: '601',
    registration_no: '202606000001',
    student_name: 'Neha Gupta',
    dob: '2012-04-18',
    mobile: '9876543212',
    marks: 54,
    status_text: 'pass',
    result_status: 'published',
  },
  {
    exam_name: 'GK 2026',
    exam_date: '2026-02-08',
    session: '2026',
    class_name: 'Class 6',
    roll_no: '602',
    registration_no: '202606000002',
    student_name: 'Karan Verma',
    dob: '2012-10-22',
    mobile: '9876543213',
    marks: 41,
    status_text: 'fail',
    result_status: 'published',
  },
  {
    exam_name: 'GK 2026',
    exam_date: '2026-02-08',
    session: '2026',
    class_name: 'Class 7',
    roll_no: '701',
    registration_no: '202607000001',
    student_name: 'Anjali Rai',
    dob: '2011-08-09',
    mobile: '9876543214',
    marks: 88,
    status_text: 'pass',
    result_status: 'published',
  },
];

export default function BulkImportScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [authReady, setAuthReady] = useState(false);

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

      setAuthReady(true);
    };

    checkAccess();
    return () => {
      active = false;
    };
  }, [router]);

  const validateRow = (row: any, index: number) => {
    const rowErrors: string[] = [];
    if (!row.roll_no || !row.student_name) {
      rowErrors.push(`Row ${index + 1}: roll_no & student_name required`);
    }
    if (!row.exam_name || !row.class_name) {
      rowErrors.push(`Row ${index + 1}: exam_name & class_name required`);
    }
    return rowErrors;
  };

  const downloadErrorReport = (rows: any[]) => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Errors');
    XLSX.writeFile(workbook, 'import-errors.xlsx');
  };

  const handleDownloadSample = () => {
    setStatus('');
    setErrors([]);
    if (Platform.OS !== 'web') {
      setErrors(['Sample download web par available hai.']);
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(sampleRows, { header: requiredColumns });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample');
    XLSX.writeFile(workbook, 'bulk-import-sample.xlsx');
  };

  const handlePickFile = async () => {
    setStatus('');
    setErrors([]);
    setPreviewRows([]);
    setProcessedCount(0);
    setTotalCount(0);

    const result = await DocumentPicker.getDocumentAsync({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] });
    if (result.canceled || !result.assets?.[0]) return;

    try {
      const file = result.assets[0];
      const response = await fetch(file.uri);
      const data = await response.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(worksheet) as any[];

      const header = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[];
      const missing = requiredColumns.filter((col) => !header.includes(col));
      if (missing.length) {
        setErrors([`Missing columns: ${missing.join(', ')}`]);
        return;
      }

      const rowErrors: string[] = [];
      rows.forEach((row: any, index: number) => {
        rowErrors.push(...validateRow(row, index));
      });
      if (rowErrors.length) {
        setErrors(rowErrors);
        downloadErrorReport(rowErrors.map((err) => ({ error: err })));
        return;
      }

      setPreviewRows(rows.slice(0, 5));
      setImporting(true);
      setTotalCount(rows.length);
      const errorRows: any[] = [];
      const insertQueue: any[] = [];

      const cache: Record<string, string> = {};
      const getCacheKey = (type: string, value: string) => `${type}:${value}`;

      const resolveSession = async (name: string) => {
        if (!name) return null;
        const key = getCacheKey('session', name);
        if (cache[key]) return cache[key];
        const { data: session } = await supabase.from('sessions').select('id').eq('name', name).maybeSingle();
        if (session?.id) {
          cache[key] = session.id;
          return session.id;
        }
        const { data: inserted } = await supabase
          .from('sessions')
          .insert({ name, status: 'active' })
          .select('id')
          .single();
        if (inserted?.id) cache[key] = inserted.id;
        return inserted?.id ?? null;
      };

      const resolveClass = async (name: string, sessionId: string | null) => {
        if (!name) return null;
        const key = getCacheKey('class', `${name}:${sessionId ?? ''}`);
        if (cache[key]) return cache[key];
        const { data: classRow } = await supabase.from('classes').select('id').eq('name', name).maybeSingle();
        if (classRow?.id) {
          cache[key] = classRow.id;
          return classRow.id;
        }
        const { data: inserted } = await supabase
          .from('classes')
          .insert({ name, session_id: sessionId, status: 'active' })
          .select('id')
          .single();
        if (inserted?.id) cache[key] = inserted.id;
        return inserted?.id ?? null;
      };

      const resolveExam = async (name: string, date: string, classId: string | null) => {
        if (!name || !date) return null;
        const key = getCacheKey('exam', `${name}:${date}`);
        if (cache[key]) return cache[key];
        const { data: examRow } = await supabase
          .from('exams')
          .select('id')
          .eq('exam_name', name)
          .eq('exam_date', date)
          .maybeSingle();
        if (examRow?.id) {
          cache[key] = examRow.id;
          return examRow.id;
        }
        const { data: inserted } = await supabase
          .from('exams')
          .insert({ exam_name: name, exam_date: date, class_id: classId, status: 'active' })
          .select('id')
          .single();
        if (inserted?.id) cache[key] = inserted.id;
        return inserted?.id ?? null;
      };

      const existingKeys = new Set<string>();
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const sessionName = String(row.session ?? '').trim();
        const className = String(row.class_name ?? '').trim();
        const examName = String(row.exam_name ?? '').trim();
        const examDate = String(row.exam_date ?? '').trim();

        const sessionId = await resolveSession(sessionName);
        const classId = await resolveClass(className, sessionId);
        const examId = await resolveExam(examName, examDate, classId);
        const rollNo = String(row.roll_no ?? '').trim();

        if (!examId || !rollNo) {
          errorRows.push({ row: index + 1, error: 'Missing exam or roll number' });
          setProcessedCount(index + 1);
          continue;
        }

        const key = `${examId}:${rollNo}`;
        if (existingKeys.has(key)) {
          errorRows.push({ row: index + 1, error: 'Duplicate roll_no in file' });
          setProcessedCount(index + 1);
          continue;
        }
        existingKeys.add(key);

        const { data: existing } = await supabase
          .from('results')
          .select('id')
          .eq('exam_id', examId)
          .eq('roll_no', rollNo)
          .maybeSingle();

        if (existing) {
          errorRows.push({ row: index + 1, error: 'Duplicate roll_no for exam' });
          setProcessedCount(index + 1);
          continue;
        }

        insertQueue.push({
          exam_id: examId,
          roll_no: rollNo,
          registration_no: row.registration_no ?? null,
          student_name: row.student_name,
          dob: row.dob ?? null,
          mobile: row.mobile ?? null,
          marks: row.marks ?? null,
          status_text: row.status_text ?? 'pass',
          result_status: row.result_status ?? 'published',
          status: 'active',
        });

        setProcessedCount(index + 1);
      }

      const batchSize = 50;
      for (let start = 0; start < insertQueue.length; start += batchSize) {
        const batch = insertQueue.slice(start, start + batchSize);
        const { error: batchError } = await supabase.from('results').insert(batch);
        if (batchError) {
          errorRows.push({ row: '-', error: batchError.message });
        }
      }

      setImporting(false);
      if (errorRows.length) {
        setErrors(errorRows.map((row) => `Row ${row.row}: ${row.error}`));
        downloadErrorReport(errorRows);
        setStatus(`Imported with ${errorRows.length} errors. Error report downloaded.`);
      } else {
        setStatus(`Imported ${rows.length} rows successfully.`);
      }
    } catch (err) {
      setErrors(['Unable to read file. Please check format.']);
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
          <Text style={styles.title}>Bulk Result Import</Text>
          <Text style={styles.subtitle}>Upload Excel (.xlsx) file in the required format.</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.cta} onPress={handlePickFile} disabled={importing}>
        <Text style={styles.ctaText}>{importing ? 'Importing...' : 'Choose Excel File'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.ctaOutline} onPress={handleDownloadSample} disabled={importing}>
        <Text style={styles.ctaOutlineText}>Download Sample Excel</Text>
      </TouchableOpacity>

      {totalCount ? (
        <View style={styles.progressBox}>
          <View style={[styles.progressBar, { width: `${Math.round((processedCount / totalCount) * 100)}%` }]} />
          <Text style={styles.progressText}>{processedCount}/{totalCount} processed</Text>
        </View>
      ) : null}

      {status ? <Text style={styles.status}>{status}</Text> : null}
      {errors.length ? (
        <View style={styles.errorBox}>
          {errors.map((err) => (
            <Text key={err} style={styles.errorText}>{err}</Text>
          ))}
        </View>
      ) : null}

      {previewRows.length ? (
        <View style={styles.previewBox}>
          <Text style={styles.rulesTitle}>Preview (Top 5)</Text>
          {previewRows.map((row, idx) => (
            <View key={`${row.roll_no}-${idx}`} style={styles.previewRow}>
              <Text style={styles.previewCell}>{row.student_name}</Text>
              <Text style={styles.previewCell}>{row.roll_no}</Text>
              <Text style={styles.previewCell}>{row.class_name}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.sampleBox}>
        <Text style={styles.rulesTitle}>Sample Import (5 Rows)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.sampleHeader}>
              {requiredColumns.map((col) => (
                <Text key={col} style={styles.sampleCell}>{col}</Text>
              ))}
            </View>
            {sampleRows.map((row) => (
              <View key={row.roll_no} style={styles.sampleRow}>
                {requiredColumns.map((col) => (
                  <Text key={`${row.roll_no}-${col}`} style={styles.sampleCell}>{String((row as Record<string, unknown>)[col] ?? '')}</Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.rulesBox}>
        <Text style={styles.rulesTitle}>Validation Rules</Text>
        <Text style={styles.ruleText}>- Same exam + same roll_no duplicate not allowed.</Text>
        <Text style={styles.ruleText}>- exam_name, class_name, roll_no, student_name required.</Text>
        <Text style={styles.ruleText}>- exam_date & dob in YYYY-MM-DD format.</Text>
        <Text style={styles.ruleText}>- status_text: pass/fail/absent.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTextWrap: { flex: 1 },
  backBtn: { borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: Colors.light.surface },
  backBtnText: { color: Colors.light.text, fontWeight: '700', fontFamily: 'Times New Roman' },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text, fontFamily: 'Times New Roman' },
  subtitle: { color: Colors.light.icon, fontFamily: 'Times New Roman' },
  cta: { backgroundColor: Colors.light.tint, padding: 12, borderRadius: 12, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontFamily: 'Times New Roman' },
  ctaOutline: { borderWidth: 1, borderColor: Colors.light.tint, padding: 12, borderRadius: 12, alignItems: 'center' },
  ctaOutlineText: { color: Colors.light.tint, fontWeight: '700', fontFamily: 'Times New Roman' },
  status: { color: Colors.light.accent, fontWeight: '600', fontFamily: 'Times New Roman' },
  errorBox: { backgroundColor: '#ffe6e6', padding: 12, borderRadius: 10 },
  errorText: { color: '#b3261e', fontSize: 13, fontFamily: 'Times New Roman' },
  progressBox: { backgroundColor: '#f3eee6', borderRadius: 10, padding: 6, marginTop: 6 },
  progressBar: { height: 6, borderRadius: 6, backgroundColor: Colors.light.tint },
  progressText: { marginTop: 6, fontSize: 12, color: Colors.light.icon, fontFamily: 'Times New Roman' },
  previewBox: { backgroundColor: Colors.light.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  previewCell: { color: Colors.light.text, fontSize: 12, fontFamily: 'Times New Roman' },
  sampleBox: { backgroundColor: Colors.light.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  sampleHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 6, borderBottomWidth: 1, borderColor: Colors.light.border },
  sampleRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  sampleCell: { color: Colors.light.text, fontSize: 12, width: 140, fontFamily: 'Times New Roman' },
  rulesBox: { backgroundColor: Colors.light.surface, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  rulesTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6, color: Colors.light.text, fontFamily: 'Times New Roman' },
  ruleText: { color: Colors.light.icon, fontSize: 13, fontFamily: 'Times New Roman' },
});
