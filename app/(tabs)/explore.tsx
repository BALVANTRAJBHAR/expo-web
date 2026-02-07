import { Picker } from '@react-native-picker/picker';
import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';

import { TopMenu } from '@/components/top-menu';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ResultRow = {
  id: string;
  roll_no: string;
  registration_no: string | null;
  student_name: string;
  dob?: string | null;
  mobile?: string | null;
  marks: number | null;
  status_text: string;
  result_status: string;
  exams?: {
    id?: string;
    exam_name: string;
    exam_date: string;
    sessions?: {
      id?: string;
      name: string;
    } | null;
    classes?: {
      id?: string;
      name: string;
    } | null;
  } | null;
};

type StudentDetails = {
  roll_no: string;
  registration_no: string;
  father_name: string | null;
  mother_name: string | null;
  address: string | null;
};

type ExamOption = {
  id: string;
  exam_name: string;
};

type ClassOption = {
  id: string;
  name: string;
};

export default function ResultsScreen() {
  const [rollOrReg, setRollOrReg] = useState('');
  const [dobOrMobile, setDobOrMobile] = useState('');
  const [sessionFilter, setSessionFilter] = useState<string>('');
  const [examFilter, setExamFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [sessionOptions, setSessionOptions] = useState<{ id: string; name: string }[]>([]);
  const [examOptions, setExamOptions] = useState<ExamOption[]>([]);
  const [classOptions, setClassOptions] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultRow | null>(null);
  const [resultStudent, setResultStudent] = useState<StudentDetails | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const searchScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fetchFilters = async () => {
      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: false });
      const { data: exams } = await supabase
        .from('exams')
        .select('id, exam_name')
        .eq('status', 'active')
        .order('exam_name', { ascending: true });
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });

      setSessionOptions((sessions as any) ?? []);
      setExamOptions(exams ?? []);
      setClassOptions(classes ?? []);
    };

    const fetchRole = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user?.id) {
        setRole(null);
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      setRole((profile as any)?.role ?? null);
    };

    const loadLogo = async () => {
      try {
        const asset = Asset.fromModule(require('@/assets/images/SEF_LOGO.png'));
        await asset.downloadAsync();
        const response = await fetch(asset.uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => setLogoDataUrl(reader.result as string);
        reader.readAsDataURL(blob);
      } catch (err) {
        setLogoDataUrl(null);
      }
    };

    if (Platform.OS === 'web') {
      loadLogo();
    }

    fetchFilters();
    fetchRole();
  }, []);

  const fetchStudentDetailsForResult = async (row: ResultRow) => {
    const reg = row.registration_no;
    const roll = row.roll_no;
    const filter = reg ? `roll_no.eq.${roll},registration_no.eq.${reg}` : `roll_no.eq.${roll}`;
    const { data } = await supabase
      .from('students')
      .select('roll_no, registration_no, father_name, mother_name, address')
      .or(filter)
      .limit(1)
      .maybeSingle();
    setResultStudent((data as any) ?? null);
  };

  const handleSearch = async () => {
    if (!rollOrReg.trim()) {
      setError('Roll number ya registration number required hai.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setResultStudent(null);

    const identifier = rollOrReg.trim();
    const filter = `roll_no.eq.${identifier},registration_no.eq.${identifier}`;
    let query = supabase
      .from('results')
      .select(
        'id, roll_no, registration_no, student_name, dob, mobile, marks, status_text, result_status, exams(id, exam_name, exam_date, sessions(id, name), classes(id, name))'
      )
      .or(filter)
      .eq('result_status', 'published')
      .limit(1);

    if (sessionFilter) {
      const { data: examRows, error: examErr } = await supabase
        .from('exams')
        .select('id')
        .eq('status', 'active')
        .eq('session_id', sessionFilter);
      if (examErr) {
        setError(examErr.message);
        setLoading(false);
        return;
      }
      const examIds = (examRows ?? []).map((x: any) => x.id).filter(Boolean);
      if (examIds.length === 0) {
        setError('Is session me koi exam nahi mila.');
        setLoading(false);
        return;
      }
      query = query.in('exam_id', examIds);
    }

    const guard = dobOrMobile.trim();
    if (guard) {
      if (guard.includes('-')) {
        query = query.eq('dob', guard);
      } else {
        query = query.eq('mobile', guard);
      }
    }

    const { data, error: fetchError } = await query.single();
    if (fetchError) {
      setError('Result nahi mila. Details check karein.');
      setLoading(false);
      return;
    }

    const row = data as ResultRow;
    setResult(row);
    await fetchStudentDetailsForResult(row);
    setLoading(false);
  };

  const addPdfHeader = (doc: any, title: string) => {
    const headerHeight = 28;
    doc.setFillColor(246, 238, 227);
    doc.rect(0, 0, 210, headerHeight, 'F');
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 12, 6, 20, 20);
    }
    doc.setFontSize(14);
    doc.text('SEF EXAM • Social Equality Federation', 36, 16);
    doc.setFontSize(11);
    doc.text(title, 36, 22);
    return headerHeight + 10;
  };

  const drawTableHeader = (doc: any, y: number, columns: string[]) => {
    doc.setFillColor(236, 224, 210);
    doc.rect(12, y - 6, 186, 10, 'F');
    doc.setFontSize(10);
    const colX = [14, 90, 132, 160];
    columns.forEach((label, idx) => {
      doc.text(label, colX[idx] ?? 14, y);
    });
    doc.setDrawColor(200);
    doc.rect(12, y - 6, 186, 10);
  };

  const drawSignature = (doc: any, y: number) => {
    doc.setDrawColor(120);
    doc.line(140, y, 198, y);
    doc.setFontSize(9);
    doc.text('Authorized Signature', 146, y + 4);
  };

  const createResultHtml = (data: ResultRow) => {
    const examName = data.exams?.exam_name ?? 'N/A';
    const examDate = data.exams?.exam_date ?? '';
    const sessionName = data.exams?.sessions?.name ?? '';
    const className = data.exams?.classes?.name ?? '';
    const logoTag = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="SEF" style="height:50px;" />`
      : '<div style="height:50px;"></div>';
    const father = resultStudent?.father_name ?? '';
    const mother = resultStudent?.mother_name ?? '';
    const addr = resultStudent?.address ?? '';
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <div style="border:1px solid #e2d2be; padding:16px;">
            <div style="display:flex; align-items:center; gap:12px;">
              ${logoTag}
              <div>
                <h2 style="margin:0;">SEF EXAM</h2>
                <p style="margin:4px 0 0;">Result Report</p>
              </div>
            </div>
            <hr />
            <p><strong>Name:</strong> ${data.student_name}</p>
            ${father ? `<p><strong>Father Name:</strong> ${father}</p>` : ''}
            ${mother ? `<p><strong>Mother Name:</strong> ${mother}</p>` : ''}
            ${addr ? `<p><strong>Address:</strong> ${addr}</p>` : ''}
            ${data.dob ? `<p><strong>DOB:</strong> ${data.dob}</p>` : ''}
            ${data.mobile ? `<p><strong>Mobile:</strong> ${data.mobile}</p>` : ''}
            <p><strong>Roll No:</strong> ${data.roll_no}</p>
            ${data.registration_no ? `<p><strong>Reg No:</strong> ${data.registration_no}</p>` : ''}
            <p><strong>Status:</strong> ${data.status_text.toUpperCase()}</p>
            <p><strong>Marks:</strong> ${data.marks ?? '-'} </p>
            ${sessionName ? `<p><strong>Session:</strong> ${sessionName}</p>` : ''}
            <p><strong>Exam:</strong> ${examName}</p>
            ${examDate ? `<p><strong>Exam Date:</strong> ${examDate}</p>` : ''}
            ${className ? `<p><strong>Class:</strong> ${className}</p>` : ''}
            <div style="margin-top:40px; text-align:right;">Authorized Signature</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleResultExcel = async () => {
    if (Platform.OS !== 'web') {
      setError('Download web par available hai.');
      return;
    }
    if (!result) {
      setError('Pehle result search karo.');
      return;
    }

    const rows = [
      {
        Name: result.student_name,
        Father: resultStudent?.father_name ?? '-',
        Mother: resultStudent?.mother_name ?? '-',
        Address: resultStudent?.address ?? '-',
        Roll: result.roll_no,
        Registration: result.registration_no ?? '-',
        Marks: result.marks ?? '-',
        Status: result.status_text,
        Session: result.exams?.sessions?.name ?? 'N/A',
        Exam: result.exams?.exam_name ?? 'N/A',
        Class: result.exams?.classes?.name ?? 'N/A',
      },
    ];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Result');
    XLSX.writeFile(workbook, `result-${result.roll_no}.xlsx`);
  };

  const handleResultPdf = async () => {
    if (!result) {
      setError('Pehle result search karo.');
      return;
    }
    if (Platform.OS !== 'web') {
      const html = createResultHtml(result);
      Print.printToFileAsync({ html })
        .then(({ uri }: { uri: string }) => Sharing.shareAsync(uri))
        .catch(() => setError('PDF generate nahi ho paaya.'));
      return;
    }

    const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
    const doc = new jsPDF();
    const startY = addPdfHeader(doc, 'Result Report');
    doc.setDrawColor(220);
    doc.rect(12, startY - 4, 186, 96);
    doc.setFontSize(12);
    let y = startY + 6;
    const line = 10;
    doc.text(`Name: ${result.student_name}`, 16, y);
    y += line;
    if (result.dob) {
      doc.text(`DOB: ${result.dob}`, 16, y);
      y += line;
    }
    if (result.mobile) {
      doc.text(`Mobile: ${result.mobile}`, 16, y);
      y += line;
    }
    if (resultStudent?.father_name) {
      doc.text(`Father: ${resultStudent.father_name}`, 16, y);
      y += line;
    }
    if (resultStudent?.mother_name) {
      doc.text(`Mother: ${resultStudent.mother_name}`, 16, y);
      y += line;
    }
    if (resultStudent?.address) {
      doc.setFontSize(10);
      doc.text(`Address: ${resultStudent.address}`, 16, y, { maxWidth: 178 });
      doc.setFontSize(12);
      y += line;
    }
    doc.text(`Roll No: ${result.roll_no}`, 16, y);
    y += line;
    if (result.registration_no) {
      doc.text(`Reg No: ${result.registration_no}`, 16, y);
      y += line;
    }
    doc.text(`Status: ${result.status_text.toUpperCase()}`, 16, y);
    y += line;
    doc.text(`Marks: ${result.marks ?? '-'}`, 16, y);
    y += line;
    const firstExam = result.exams;
    if (firstExam) {
      doc.text(`Exam: ${firstExam.exam_name}`, 16, y);
      y += line;
      if (firstExam.exam_date) {
        doc.text(`Exam Date: ${firstExam.exam_date}`, 16, y);
        y += line;
      }
      const sess = firstExam.sessions?.name;
      if (sess) {
        doc.text(`Session: ${sess}`, 16, y);
        y += line;
      }
      const cls = firstExam.classes?.name;
      if (cls) {
        doc.text(`Class: ${cls}`, 16, y);
      }
    }
    drawSignature(doc, startY + 64);
    doc.save(`result-${result.roll_no}.pdf`);
  };

  const handleListDownload = async (type: 'pdf' | 'excel') => {
    if (Platform.OS !== 'web') {
      setError('Download web par available hai.');
      return;
    }

    let query = supabase
      .from('results')
      .select('roll_no, registration_no, student_name, marks, status_text, exams(id, exam_name, session_id, sessions(id, name), classes(id, name))')
      .eq('result_status', 'published');

    if (sessionFilter) {
      const { data: examRows, error: examErr } = await supabase
        .from('exams')
        .select('id')
        .eq('status', 'active')
        .eq('session_id', sessionFilter);
      if (examErr) {
        setError(examErr.message);
        return;
      }
      const examIds = (examRows ?? []).map((x: any) => x.id).filter(Boolean);
      if (examIds.length === 0) {
        setError('Is session me koi exam nahi mila.');
        return;
      }
      query = query.in('exam_id', examIds);
    }

    if (examFilter) {
      query = query.eq('exam_id', examFilter);
    }
    if (classFilter) {
      query = query.eq('exams.class_id', classFilter);
    }

    const { data, error: listError } = await query.limit(200);

    if (listError || !data || data.length === 0) {
      setError('No data found.');
      return;
    }

    const rollNos = Array.from(new Set((data as any[]).map((row) => row.roll_no).filter(Boolean)));
    const { data: students } = rollNos.length
      ? await supabase
          .from('students')
          .select('roll_no, registration_no, father_name, mother_name, address')
          .in('roll_no', rollNos)
      : { data: [] as any[] };
    const studentMap = new Map<string, StudentDetails>();
    (students ?? []).forEach((st: any) => {
      if (st?.roll_no) studentMap.set(String(st.roll_no), st as StudentDetails);
    });

    if (type === 'excel') {
      const rows = data.map((row) => ({
        Name: row.student_name,
        Father: studentMap.get(String(row.roll_no))?.father_name ?? '-',
        Mother: studentMap.get(String(row.roll_no))?.mother_name ?? '-',
        Address: studentMap.get(String(row.roll_no))?.address ?? '-',
        Roll: row.roll_no,
        Registration: row.registration_no ?? '-',
        Marks: row.marks ?? '-',
        Status: row.status_text,
        Session: (row as any).exams?.sessions?.name ?? 'N/A',
        Exam: (row as any).exams?.exam_name ?? 'N/A',
        Class: (row as any).exams?.classes?.name ?? 'N/A',
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
      XLSX.writeFile(workbook, 'result-list.xlsx');
      return;
    }

    if (Platform.OS !== 'web') {
      const logoTag = logoDataUrl
        ? `<img src="${logoDataUrl}" alt="SEF" style="height:40px;" />`
        : '';
      const listHtml = `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <div style="display:flex; align-items:center; gap:12px;">
              ${logoTag}
              <div>
                <h2 style="margin:0;">SEF EXAM</h2>
                <p style="margin:4px 0 0;">Result List</p>
              </div>
            </div>
            <table style="width:100%; border-collapse: collapse;" border="1">
              <thead>
                <tr style="background:#f3e4d2">
                  <th>Name</th><th>Roll</th><th>Father</th><th>Mother</th><th>Address</th><th>Marks</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${data
                  .map(
                    (row) =>
                      `<tr><td>${row.student_name}</td><td>${row.roll_no}</td><td>${studentMap.get(String(row.roll_no))?.father_name ?? '-'}</td><td>${studentMap.get(String(row.roll_no))?.mother_name ?? '-'}</td><td>${studentMap.get(String(row.roll_no))?.address ?? '-'}</td><td>${row.marks ?? '-'}</td><td>${row.status_text}</td></tr>`
                  )
                  .join('')}
              </tbody>
            </table>
            <div style="margin-top:40px; text-align:right;">Authorized Signature</div>
          </body>
        </html>
      `;
      Print.printToFileAsync({ html: listHtml })
        .then(({ uri }: { uri: string }) => Sharing.shareAsync(uri))
        .catch(() => setError('PDF generate nahi ho paaya.'));
      return;
    }

    const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
    const doc = new jsPDF();
    let y = addPdfHeader(doc, 'Result List');
    drawTableHeader(doc, y, ['Name', 'Roll', 'Marks', 'Status']);
    y += 8;
    const colX = [12, 88, 128, 156, 198];
    data.forEach((row) => {
      doc.setFontSize(10);
      doc.text(row.student_name, 14, y);
      doc.text(row.roll_no, 90, y);
      doc.text(String(row.marks ?? '-'), 132, y);
      doc.text(row.status_text, 160, y);
      doc.setDrawColor(220);
      doc.line(colX[0], y + 2, colX[4], y + 2);
      doc.line(colX[0], y - 6, colX[0], y + 2);
      doc.line(colX[1], y - 6, colX[1], y + 2);
      doc.line(colX[2], y - 6, colX[2], y + 2);
      doc.line(colX[3], y - 6, colX[3], y + 2);
      doc.line(colX[4], y - 6, colX[4], y + 2);
      y += 8;
      const st = studentMap.get(String(row.roll_no));
      if (st?.father_name || st?.mother_name || st?.address) {
        doc.setFontSize(9);
        const pieces = [
          st?.father_name ? `Father: ${st.father_name}` : null,
          st?.mother_name ? `Mother: ${st.mother_name}` : null,
          st?.address ? `Address: ${st.address}` : null,
        ].filter(Boolean);
        if (pieces.length) {
          doc.text(pieces.join(' • '), 14, y, { maxWidth: 182 });
          y += 7;
        }
      }
      if (y > 260) {
        doc.setFontSize(9);
        doc.text('Generated by SEF EXAM Portal', 14, 280);
        drawSignature(doc, 270);
        doc.addPage();
        y = addPdfHeader(doc, 'Result List');
        drawTableHeader(doc, y, ['Name', 'Roll', 'Marks', 'Status']);
        y += 8;
      }
    });
    doc.setFontSize(9);
    doc.text('Generated by SEF EXAM Portal', 14, y + 18);
    drawSignature(doc, y + 10);
    doc.save('result-list.pdf');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.fullWidth}>
        <TopMenu subtitle="Result Search" />
      </View>
      <View style={styles.pageWrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Result Search</Text>
          <Text style={styles.subtitle}>Roll no / Registration no se result dekhein.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Session (Optional)</Text>
          <View style={styles.pickerWrapper}>
            <Picker selectedValue={sessionFilter} onValueChange={(value) => setSessionFilter(String(value))}>
              <Picker.Item label="All Sessions" value="" />
              {sessionOptions.map((s) => (
                <Picker.Item key={s.id} label={s.name} value={s.id} />
              ))}
            </Picker>
          </View>
          <Text style={styles.label}>Roll Number</Text>
          <TextInput
            placeholder="Enter roll / registration number"
            style={styles.input}
            value={rollOrReg}
            onChangeText={setRollOrReg}
          />
          <Text style={styles.label}>DOB / Mobile (Optional)</Text>
          <TextInput
            placeholder="YYYY-MM-DD या मोबाइल"
            style={styles.input}
            value={dobOrMobile}
            onChangeText={setDobOrMobile}
          />
          <View style={styles.searchBtnRow}>
            <Animated.View style={{ transform: [{ scale: searchScale }], flex: 1 }}>
              <Pressable
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                onPress={handleSearch}
                onPressIn={() =>
                  Animated.spring(searchScale, { toValue: 0.97, useNativeDriver: true, friction: 6 }).start()
                }
                onPressOut={() => Animated.spring(searchScale, { toValue: 1, useNativeDriver: true }).start()}
                disabled={loading}
              >
                <Text style={styles.ctaText}>{loading ? 'Searching...' : 'Search Result'}</Text>
              </Pressable>
            </Animated.View>
            <TouchableOpacity
              style={[styles.cta, styles.ctaSecondary, (!result || loading) && styles.ctaDisabled]}
              onPress={handleResultExcel}
              disabled={!result || loading}
            >
              <Text style={styles.ctaText}>Download Excel</Text>
            </TouchableOpacity>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.sectionTitle}>Result Found</Text>
            <Text style={styles.resultName}>{result.student_name}</Text>
            {resultStudent?.father_name ? <Text style={styles.resultMeta}>Father: {resultStudent.father_name}</Text> : null}
            {resultStudent?.mother_name ? <Text style={styles.resultMeta}>Mother: {resultStudent.mother_name}</Text> : null}
            {resultStudent?.address ? <Text style={styles.resultMeta}>Address: {resultStudent.address}</Text> : null}
            <Text style={styles.resultMeta}>Roll No: {result.roll_no}</Text>
            {result.registration_no ? (
              <Text style={styles.resultMeta}>Reg No: {result.registration_no}</Text>
            ) : null}
            <Text style={styles.resultMeta}>Status: {result.status_text.toUpperCase()}</Text>
            {result.marks !== null ? (
              <Text style={styles.resultScore}>Marks: {result.marks}</Text>
            ) : null}
            {result.exams?.sessions?.name ? (
              <Text style={styles.resultExam}>Session: {result.exams.sessions.name}</Text>
            ) : null}
            {result.exams ? <Text style={styles.resultExam}>Exam: {result.exams.exam_name}</Text> : null}
            {result.exams?.classes?.name ? <Text style={styles.resultExam}>Class: {result.exams.classes.name}</Text> : null}

            <View style={styles.chipRow}>
              <TouchableOpacity style={styles.chip} onPress={handleResultPdf}>
                <Text style={styles.chipText}>Download PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={handleResultExcel}>
                <Text style={styles.chipText}>Download Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {role === 'admin' || role === 'staff' ? (
          <View style={styles.cardAlt}>
            <Text style={styles.sectionTitle}>Downloads</Text>
            <Text style={styles.desc}>Result PDF aur merit list yahin se download hogi.</Text>
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={styles.label}>Session Filter</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={sessionFilter} onValueChange={(value) => setSessionFilter(String(value))}>
                    <Picker.Item label="All Sessions" value="" />
                    {sessionOptions.map((s) => (
                      <Picker.Item key={s.id} label={s.name} value={s.id} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.filterField}>
                <Text style={styles.label}>Exam Filter</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={examFilter} onValueChange={(value) => setExamFilter(value)}>
                    <Picker.Item label="All Exams" value="" />
                    {examOptions.map((exam) => (
                      <Picker.Item key={exam.id} label={exam.exam_name} value={exam.id} />
                    ))}
                  </Picker>
                </View>
              </View>
              <View style={styles.filterField}>
                <Text style={styles.label}>Class Filter</Text>
                <View style={styles.pickerWrapper}>
                  <Picker selectedValue={classFilter} onValueChange={(value) => setClassFilter(value)}>
                    <Picker.Item label="All Classes" value="" />
                    {classOptions.map((item) => (
                      <Picker.Item key={item.id} label={item.name} value={item.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>
            <View style={styles.chipRow}>
              <TouchableOpacity style={styles.chip} onPress={() => handleListDownload('pdf')}>
                <Text style={styles.chipText}>Download List PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.chip} onPress={() => handleListDownload('excel')}>
                <Text style={styles.chipText}>Download List Excel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 20,
    gap: 16,
    alignItems: 'stretch',
  },
  fullWidth: {
    width: '100%',
    alignSelf: 'stretch',
  },
  pageWrap: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: 16,
  },
  header: {
    backgroundColor: Colors.light.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: Colors.light.icon,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    width: '100%',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    color: Colors.light.icon,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  input: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    width: '100%',
  },
  cta: {
    marginTop: 14,
    backgroundColor: '#cc7f3c',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
    minWidth: 0,
    width: '100%',
    paddingHorizontal: 32,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaSecondary: {
    backgroundColor: '#b56f34',
    marginTop: 14,
    flex: 0.6,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
  },
  searchBtnRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  cardAlt: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    width: '100%',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  desc: {
    color: Colors.light.icon,
    marginBottom: 12,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  filterRow: {
    gap: 12,
    marginBottom: 12,
    width: '100%',
  },
  filterField: {
    flex: 1,
    width: '100%',
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceAlt,
    width: '100%',
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.accentSoft,
    borderRadius: 16,
  },
  chipText: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  errorText: {
    marginTop: 10,
    color: '#b3261e',
    fontSize: 13,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    width: '100%',
    alignItems: 'center',
  },
  resultName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  resultMeta: {
    color: Colors.light.icon,
    marginBottom: 4,
    textAlign: 'center',
  },
  resultScore: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.tint,
    marginTop: 6,
    textAlign: 'center',
  },
  resultExam: {
    marginTop: 6,
    color: Colors.light.text,
    textAlign: 'center',
  },
});
