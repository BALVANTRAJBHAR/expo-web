import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 550, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleReset = async () => {
    if (!email.trim()) {
      setMessage('Email required hai.');
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (error) {
      setMessage('Reset link send nahi ho paaya.');
      return;
    }
    setMessage('Reset link bhej diya gaya hai.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}> 
        <Text style={styles.title}>Forgot Password</Text>
        <Text style={styles.subtitle}>Email par reset link bheja jayega.</Text>

        <Text style={styles.label}>Email / Gmail</Text>
        <TextInput
          placeholder="Enter email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
          value={email}
          onChangeText={setEmail}
        />

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <TouchableOpacity style={styles.button} onPress={handleReset} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send Reset Link'}</Text>
        </TouchableOpacity>

        <View style={styles.linkRow}>
          <Link href={'/auth/login' as any} style={styles.link}>Back to Login</Link>
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
  linkRow: {
    marginTop: 14,
    alignItems: 'center',
  },
  link: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
});
