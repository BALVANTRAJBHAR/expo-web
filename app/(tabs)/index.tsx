import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Image as RNImage, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { TopMenu } from '@/components/top-menu';
import { Colors, Palette } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const highlights = [
  { title: 'Result Search', desc: 'Roll number se turant result dekho aur download karo.' },
  { title: 'Upcoming Exams', desc: 'Next exam date aur schedule ek jagah par.' },
  { title: 'Admin Dashboard', desc: 'Result entry, bulk import aur reports.' },
];

type UpcomingExam = {
  id: string;
  exam_name: string;
  exam_date: string;
  classes?: { name: string }[] | null;
};

export default function HomeScreen() {
  const theme = Colors.light;
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [upcoming, setUpcoming] = useState<UpcomingExam[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(true);
  const isWide = width >= 720;

  const ensureLogin = async (nextPath: string) => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      router.replace({ pathname: '/auth/login' as any, params: { next: nextPath } } as any);
      return false;
    }
    return true;
  };

  const requireAdmin = async (nextPath: string) => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      router.replace({ pathname: '/auth/login' as any, params: { next: nextPath } } as any);
      return false;
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (profile as any)?.role ?? null;
    if (role !== 'admin' && role !== 'staff') {
      router.replace('/(tabs)' as any);
      return false;
    }
    return true;
  };

  const handleHighlightPress = async (title: string) => {
    if (title === 'Result Search') {
      router.push('/(tabs)/explore' as any);
      return;
    }
    if (title === 'Upcoming Exams') {
      router.push('/(tabs)/exams' as any);
      return;
    }
    if (title === 'Admin Dashboard') {
      const ok = await requireAdmin('/admin/bulk-import');
      if (ok) router.push('/admin/bulk-import' as any);
    }
  };

  const handleRibbonPress = async () => {
    const nextPath = '/student/register';
    const ok = await ensureLogin(nextPath);
    if (ok) router.push(nextPath as any);
  };

  useEffect(() => {
    let active = true;
    const loadUpcoming = async () => {
      setLoadingUpcoming(true);
      const { data } = await supabase
        .from('exams')
        .select('id, exam_name, exam_date, classes(name)')
        .gte('exam_date', new Date().toISOString())
        .order('exam_date', { ascending: true })
        .limit(3);
      if (active) {
        setUpcoming(data ?? []);
        setLoadingUpcoming(false);
      }
    };
    loadUpcoming();
    return () => {
      active = false;
    };
  }, []);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return `${parsed.toLocaleDateString()} • ${parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TopMenu subtitle="Exam Portal" />
      <View style={[styles.hero, { backgroundColor: theme.surface }]}>
        <Text style={styles.heroTitle}>Samanya Gyan Pratiyogita</Text>
        <Text style={styles.heroSubtitle}>
          Ek Bharat - Shreshtha Bharat • 1 se 10 tak ke sabhi chhatra/chhatraayein shamil ho sakte
          hain.
        </Text>
        <View style={[styles.heroNote, { backgroundColor: theme.accentSoft }]}
        >
          <Text style={styles.heroNoteText}>Pratiyogita nishulk hai • Certificate + Merit list</Text>
        </View>
        <View style={styles.heroRibbon}>
          <TouchableOpacity onPress={handleRibbonPress}>
            <Text style={styles.heroRibbonText}>2026 • Free Registration • Merit Based Awards</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bannerSection}>
        <View style={[styles.bannerRow, isWide && styles.bannerRowWide]}>
          <RNImage
            source={require('@/assets/images/sef-exam-banner.jpeg')}
            style={[styles.bannerImage, isWide && styles.bannerImageWide]}
          />
          <View style={styles.bannerTextBox}>
            <Text style={styles.bannerTitle}>Samanya Gyan Pratiyogita 2026</Text>
            <Text style={styles.bannerText}>
              Dinank 08 Feb 2026 • Pratah 9 baje se. Class 1 se 10 tak sabhi chhatra/chhatraayein
              shamil ho sakte hain. Pratiyogita poori tarah nishulk hai.
            </Text>
          </View>
        </View>
        <View style={[styles.bannerRowReverse, isWide && styles.bannerRowReverseWide]}>
          <RNImage source={require('@/assets/images/sef-banner.jpeg')} style={[styles.bannerImage, isWide && styles.bannerImageWide]} />
          <View style={styles.bannerTextBox}>
            <Text style={styles.bannerTitle}>Social Equality Federation</Text>
            <Text style={styles.bannerText}>
              Ek Bharat - Shreshtha Bharat. Samajik samanta aur shiksha ko badhava dena hamara
              mission hai. Certificate + merit list sabhi ke liye.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.quickStats}>
        {loadingUpcoming ? (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Upcoming Exams</Text>
            <Text style={styles.statValue}>Loading...</Text>
          </View>
        ) : upcoming.length === 0 ? (
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Upcoming Exams</Text>
            <Text style={styles.statValue}>No upcoming exams</Text>
          </View>
        ) : (
          upcoming.map((item) => (
            <View key={item.id} style={styles.statCard}>
              <Text style={styles.statLabel}>{item.exam_name}</Text>
              <Text style={styles.statValue}>{formatDate(item.exam_date)}</Text>
              <Text style={styles.statMeta}>{item.classes?.[0]?.name ?? 'All Classes'}</Text>
            </View>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Highlights</Text>
        <View style={styles.cardGrid}>
          {highlights.map((item) => (
            <TouchableOpacity key={item.title} style={styles.card} onPress={() => handleHighlightPress(item.title)}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Services</Text>
        <View style={styles.cardGrid}>
          <View style={styles.cardWide}>
            <Text style={styles.cardTitle}>Online Result Portal</Text>
            <Text style={styles.cardDesc}>Secure result lookup with PDF download.</Text>
          </View>
          <View style={styles.cardWide}>
            <Text style={styles.cardTitle}>Exam Schedule</Text>
            <Text style={styles.cardDesc}>All upcoming exam dates in one place.</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionSplit}>
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>About Us</Text>
          <Text style={styles.cardDesc}>
            Samajik samanta aur shiksha ko badhava dena hamara mission hai. Hum talent ko equal
            platform dene ke liye pariksha aayojit karte hain.
          </Text>
        </View>
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <TouchableOpacity onPress={() => Linking.openURL('tel:9005924205')}>
            <Text style={styles.cardDesc}>Phone: 9005924205</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                'https://www.google.com/maps/place/' +
                  encodeURIComponent('Gopiganj, Uttar Pradesh 221303')
              )
            }
          >
            <Text style={styles.cardDesc}>Address: Gorai, Gopiganj, Bhadohi</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Important Notice</Text>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Koi fees nahi hai. Registration free hai.</Text>
          <Text style={styles.noticeText}>Result online portal par publish hoga.</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => Linking.openURL('https://share.google/4YPN2GjnBqI2jv1Z9')}>
          <Text style={styles.footerText}>© BT SOFTECH</Text>
        </TouchableOpacity>
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
    paddingBottom: 48,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    alignItems: 'center',
  },
  bannerSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  bannerRow: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  bannerRowReverse: {
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  bannerRowWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  bannerRowReverseWide: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
  },
  bannerImage: {
    width: '100%',
    height: 349,
    backgroundColor: Colors.light.surfaceAlt,
  },
  bannerImageWide: {
    width: '50%',
    height: '100%',
    minHeight: 349,
  },
  bannerTextBox: {
    padding: 16,
    flex: 1,
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
    fontFamily: 'Times New Roman',
  },
  bannerText: {
    color: Colors.light.icon,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: 'Times New Roman',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 10,
    textAlign: 'center',
    fontFamily: 'Times New Roman',
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.light.icon,
    textAlign: 'center',
    fontFamily: 'Times New Roman',
  },
  heroNote: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: Colors.light.accentSoft,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  heroNoteText: {
    fontSize: 13,
    color: Colors.light.accent,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'Times New Roman',
  },
  heroRibbon: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: Colors.light.tint,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  heroRibbonText: {
    color: '#fffdf8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textAlign: 'center',
    fontFamily: 'Times New Roman',
  },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: Colors.light.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.icon,
    marginBottom: 6,
    fontFamily: 'Times New Roman',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    fontFamily: 'Times New Roman',
  },
  statMeta: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 4,
    fontFamily: 'Times New Roman',
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
    fontFamily: 'Times New Roman',
  },
  cardGrid: {
    gap: 12,
  },
  card: {
    padding: 14,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  cardWide: {
    padding: 16,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  loginCard: {
    padding: 18,
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  loginTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
    fontFamily: 'Times New Roman',
  },
  loginDesc: {
    fontSize: 14,
    color: Colors.light.icon,
    marginBottom: 12,
    fontFamily: 'Times New Roman',
  },
  loginButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontFamily: 'Times New Roman',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
    fontFamily: 'Times New Roman',
  },
  cardDesc: {
    fontSize: 14,
    color: Colors.light.icon,
    lineHeight: 20,
    fontFamily: 'Times New Roman',
  },
  sectionSplit: {
    paddingHorizontal: 20,
    gap: 14,
  },
  sectionBox: {
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  notice: {
    backgroundColor: Palette.emerald,
    borderRadius: 14,
    padding: 16,
  },
  noticeText: {
    color: '#f6f0e8',
    fontSize: 14,
    marginBottom: 6,
    fontFamily: 'Times New Roman',
  },
  footer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18, alignItems: 'center' },
  footerText: { color: Colors.light.icon, fontSize: 12, fontFamily: 'Times New Roman' },
});
