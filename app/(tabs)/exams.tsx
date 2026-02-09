import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';

import { TopMenu } from '@/components/top-menu';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ExamRow = {
  id: string;
  exam_name: string;
  exam_date: string;
  status: string;
  is_upcoming: boolean;
};

export default function ExamsScreen() {
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

  const formatDateTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    try {
      return parsed.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  const upcoming = useMemo(() => {
    const now = Date.now();
    return exams.filter((exam) => {
      const parsed = new Date(exam.exam_date).getTime();
      return Number.isNaN(parsed) ? exam.is_upcoming : parsed >= now;
    });
  }, [exams]);

  useEffect(() => {
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

    const fetchExams = async () => {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('exams')
        .select('id, exam_name, exam_date, status, is_upcoming')
        .eq('status', 'active')
        .order('exam_date', { ascending: true });

      if (fetchError) {
        setError('Exams load nahi ho paaye.');
        setLoading(false);
        return;
      }

      setExams(data ?? []);
      setLoading(false);
    };

    fetchExams();
  }, []);

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

  const drawTableHeader = (doc: any, y: number) => {
    doc.setFillColor(236, 224, 210);
    doc.rect(12, y - 6, 186, 10, 'F');
    doc.setFontSize(10);
    doc.text('Exam', 14, y);
    doc.text('Date', 140, y);
    doc.rect(12, y - 6, 186, 10);
  };

  const drawSignature = (doc: any, y: number) => {
    doc.setDrawColor(120);
    doc.line(140, y, 198, y);
    doc.setFontSize(9);
    doc.text('Authorized Signature', 146, y + 4);
  };

  const createExamHtml = () => {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 24px;">
          <h2>SEF EXAM</h2>
          <p>Upcoming Exam Schedule</p>
          <table style="width:100%; border-collapse: collapse;" border="1">
            <thead>
              <tr style="background:#f3e4d2">
                <th>Exam</th><th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${upcoming.map((exam) => `<tr><td>${exam.exam_name}</td><td>${formatDateTime(exam.exam_date)}</td></tr>`).join('')}
            </tbody>
          </table>
          <div style="margin-top:40px; text-align:right;">Authorized Signature</div>
        </body>
      </html>
    `;
  };

  const handleDownloadPdf = async () => {
    if (!upcoming.length) {
      setError('No data found.');
      return;
    }

    if (Platform.OS !== 'web') {
      const html = createExamHtml();
      Print.printToFileAsync({ html })
        .then(({ uri }: { uri: string }) => Sharing.shareAsync(uri))
        .catch(() => setError('PDF generate nahi ho paaya.'));
      return;
    }

    const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js');
    const doc = new jsPDF();
    let y = addPdfHeader(doc, 'Upcoming Exam Schedule');
    drawTableHeader(doc, y);
    y += 8;
    upcoming.forEach((exam) => {
      doc.setFontSize(10);
      doc.text(exam.exam_name, 14, y);
      doc.text(formatDateTime(exam.exam_date), 140, y);
      y += 8;
      if (y > 260) {
        drawSignature(doc, 270);
        doc.addPage();
        y = addPdfHeader(doc, 'Upcoming Exam Schedule');
        drawTableHeader(doc, y);
        y += 8;
      }
    });
    drawSignature(doc, y + 10);
    doc.save('exam-schedule.pdf');
  };

  const handleDownloadExcel = () => {
    if (!upcoming.length) {
      setError('No data found.');
      return;
    }

    if (Platform.OS !== 'web') {
      setError('Excel download web par available hai.');
      return;
    }

    const rows = upcoming.map((exam) => ({
      Exam: exam.exam_name,
      Date: formatDateTime(exam.exam_date),
      Upcoming: exam.is_upcoming ? 'Yes' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Exams');
    XLSX.writeFile(workbook, 'exam-schedule.xlsx');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TopMenu subtitle="Upcoming Exams" />
      <View style={styles.header}>
        <Text style={styles.title}>Upcoming Exams</Text>
        <Text style={styles.subtitle}>Next exam dates aur schedule.</Text>
      </View>

      {loading ? <Text style={styles.subtitle}>Loading exams...</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {upcoming.map((exam) => (
        <View key={exam.id} style={styles.card}>
          <Text style={styles.examName}>{exam.exam_name}</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDateTime(exam.exam_date)}</Text>
          </View>
        </View>
      ))}

      <View style={styles.downloadCard}>
        <Text style={styles.downloadTitle}>Download All Exam Dates (PDF)</Text>
        <Text style={styles.subtitle}>Schedule list ko PDF me download karein.</Text>
        <View style={styles.downloadActions}>
          <TouchableOpacity style={styles.downloadChip} onPress={handleDownloadPdf}>
            <Text style={styles.downloadChipText}>Download PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.downloadChip} onPress={handleDownloadExcel}>
            <Text style={styles.downloadChipText}>Download Excel</Text>
          </TouchableOpacity>
        </View>
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
  header: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    padding: 18,
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
  },
  examName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    width: '100%',
  },
  label: {
    fontSize: 13,
    color: Colors.light.icon,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  downloadCard: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    width: '100%',
    alignItems: 'center',
  },
  downloadTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  downloadChip: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: Colors.light.accentSoft,
  },
  downloadActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  downloadChipText: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  errorText: {
    color: '#b3261e',
    fontSize: 13,
  },
});
