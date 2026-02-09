import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const next = typeof params.next === 'string' ? params.next : '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setMessage('Email aur password required hai.');
      return;
    }

    setLoading(true);
    setMessage(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      setMessage(error?.message ?? 'Login failed.');
      setLoading(false);
      return;
    }

    if (!data.user.email_confirmed_at) {
      setMessage('Email verify nahi hai. Pehle verify karo, phir login karo.');
      setLoading(false);
      return;
    }

    try {
      let { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!profile) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: data.user.user_metadata?.full_name ?? data.user.email ?? 'User',
          role: 'student',
          status: 'active',
        });

        const { data: refreshed } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();
        profile = refreshed ?? null;
      }

      if (next) {
        router.replace(next as any);
        return;
      }

      if (profile?.role === 'admin' || profile?.role === 'staff') {
        router.replace('/admin/bulk-import' as any);
        return;
      }
      router.replace('/(tabs)' as any);
    } catch {
      Alert.alert('Login', 'Login ho gaya, par redirect fail ho gaya.');
      router.replace('/(tabs)' as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Continue karne ke liye login karein.</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          placeholder="Email"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />
        <TextInput
          placeholder="Password"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        <TouchableOpacity style={styles.cta} onPress={handleLogin} disabled={loading}>
          <Text style={styles.ctaText}>{loading ? 'Logging in...' : 'Login'}</Text>
        </TouchableOpacity>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <View style={styles.linkRow}>
          <Link href={'/auth/register' as any} style={styles.link}>
            Create account
          </Link>
          <Link href={'/auth/forgot' as any} style={styles.link}>
            Forgot password?
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, gap: 12 },
  header: {
    backgroundColor: Colors.light.surface,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text, textAlign: 'center', fontFamily: 'Times New Roman' },
  subtitle: { marginTop: 6, fontSize: 14, color: Colors.light.icon, textAlign: 'center', fontFamily: 'Times New Roman' },
  card: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.light.border,
    gap: 10,
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
  cta: { backgroundColor: Colors.light.tint, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '700', fontFamily: 'Times New Roman' },
  message: { color: Colors.light.accent, fontWeight: '600', fontFamily: 'Times New Roman' },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  link: { color: Colors.light.tint, fontWeight: '700', fontFamily: 'Times New Roman' },
});
