import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { supabase } from '@/lib/supabase';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let active = true;

    const ensureProfile = async (user: { id: string; email?: string | null; user_metadata?: any } | null) => {
      if (!user || !active) return;
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (existing) return;
      await supabase.from('profiles').insert({
        id: user.id,
        full_name: user.user_metadata?.full_name ?? user.email ?? 'User',
        role: 'student',
        status: 'active',
      });
    };

    supabase.auth.getSession().then(({ data }) => ensureProfile(data.session?.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      ensureProfile(session?.user ?? null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
