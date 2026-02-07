import { Link, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [name, setName] = useState('');
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

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      setMessage('Name, email aur password required hai.');
      return;
    }
    setLoading(true);
    setMessage(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          display_name: name.trim(),
        },
      },
    });

    if (error || !data.user) {
      const errorMsg = error?.message?.toLowerCase() ?? '';
      if (errorMsg.includes('already') || errorMsg.includes('exists') || errorMsg.includes('registered')) {
        setMessage('This email already exists. Please login.');
      } else {
        setMessage(error?.message ?? 'Registration failed.');
      }
      setLoading(false);
      return;
    }

    const shouldInsertProfile = !!data.session?.user;
    const { error: profileError } = shouldInsertProfile
      ? await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: name.trim(),
          role: 'student',
          status: 'active',
        })
      : { error: null };

    setLoading(false);
    setMessage('Registration successful. Email verify karne ka link bhej diya gaya hai.');
    if (profileError) {
      setMessage(`Registration successful, but profile save failed: ${profileError.message}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}> 
        <Text style={styles.title}>Register</Text>
        <Text style={styles.subtitle}>New user ke liye account banayein.</Text>

        <Text style={styles.label}>Full Name</Text>
        <TextInput placeholder="Enter full name" style={styles.input} value={name} onChangeText={setName} />

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
          placeholder="Create password"
          secureTextEntry
          style={styles.input}
          value={password}
          onChangeText={setPassword}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Creating...' : 'Create Account'}</Text>
        </TouchableOpacity>

        <Link href={'/auth/login' as any} style={styles.link}>Already have account? Login</Link>
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
    width: '100%',
    maxWidth: 420,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
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
    color: Colors.light.accent,
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
  link: {
    marginTop: 14,
    color: Colors.light.accent,
    fontWeight: '600',
    textAlign: 'center',
  },
});
