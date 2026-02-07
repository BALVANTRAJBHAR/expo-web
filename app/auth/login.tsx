import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setMessage('Email/Gmail aur password required hai.');
      return;
    }
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      const errorMsg = error?.message?.toLowerCase() ?? '';
      if (errorMsg.includes('confirm') || errorMsg.includes('verified')) {
        setMessage('Email verify nahi hai. Pehle verify karo, phir login karo.');
      } else {
        setMessage('Login failed. Details check karein.');
      }
      setLoading(false);
      return;
    }

    if (!data.user.email_confirmed_at) {
      setMessage('Email verify nahi hai. Pehle verify karo, phir login karo.');
      setLoading(false);
      return;
    }

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

    setLoading(false);
    if (profile?.role === 'admin' || profile?.role === 'staff') {
      router.replace('/(tabs)' as any);
      return;
    }

    router.replace('/(tabs)' as any);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}> 
        <View style={styles.brandRow}>
          <Image source={require('@/assets/images/SEF_LOGO.png')} style={styles.logo} />
          <View>
            <Text style={styles.brand}>Social Equality Federation</Text>
            <Text style={styles.brandSub}>Secure Admin/Staff Login</Text>
          </View>
        </View>

        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Username/Gmail aur password se login karein.</Text>

        <Text style={styles.label}>Email / Gmail</Text>
        <TextInput
          placeholder="Enter email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          placeholder="Enter password"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Logging in...' : 'Login'}</Text>
        </TouchableOpacity>

        <View style={styles.linkRow}>
          <Link href={'/auth/forgot' as any} style={styles.link}>Forgot password?</Link>
          <Link href={'/auth/register' as any} style={styles.link}>New user? Register</Link>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 24,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    width: '100%',
    maxWidth: 420,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logo: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },
  brand: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.light.text,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  brandSub: {
    color: Colors.light.icon,
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.light.text,
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.light.icon,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    color: Colors.light.icon,
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  message: {
    color: '#b3261e',
    marginBottom: 10,
  },
  button: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
  },
  linkRow: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  link: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
});
