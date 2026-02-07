import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image as RNImage, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type TopMenuProps = {
  subtitle?: string;
};

export function TopMenu({ subtitle }: TopMenuProps) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const user = data.session?.user ?? null;
      setDisplayName(user?.user_metadata?.full_name ?? user?.email ?? null);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (mounted) setRole(profile?.role ?? null);
      } else {
        setRole(null);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setDisplayName(user?.user_metadata?.full_name ?? user?.email ?? null);
      if (!user) {
        setRole(null);
        return;
      }
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (mounted) setRole(profile?.role ?? null);
        });
    });

    init();
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <RNImage source={require('@/assets/images/SEF_LOGO.png')} style={styles.logo} />
          <View>
            <Text style={styles.brand}>Social Equality Federation</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={styles.authBox}>
          {displayName ? <Text style={styles.welcome}>Welcome, {displayName}</Text> : null}
          {displayName ? (
            <TouchableOpacity style={styles.loginBtn} onPress={handleLogout}>
              <Text style={styles.loginText}>Logout</Text>
            </TouchableOpacity>
          ) : (
            <Link href={'/auth/login' as any} asChild>
              <TouchableOpacity style={styles.loginBtn}>
                <Text style={styles.loginText}>Login</Text>
              </TouchableOpacity>
            </Link>
          )}
        </View>
      </View>
      {role === 'admin' || role === 'staff' ? (
        <View style={styles.adminBar}>
          <Text style={styles.adminLabel}>Admin Services:</Text>
          <Link href={'/admin/bulk-import' as any} asChild>
            <TouchableOpacity style={styles.adminChip}>
              <Text style={styles.adminChipText}>Bulk Import</Text>
            </TouchableOpacity>
          </Link>
          <Link href={'/admin/single-insert' as any} asChild>
            <TouchableOpacity style={styles.adminChip}>
              <Text style={styles.adminChipText}>Add Result</Text>
            </TouchableOpacity>
          </Link>
          <Link href={'/admin/exam-date' as any} asChild>
            <TouchableOpacity style={styles.adminChip}>
              <Text style={styles.adminChipText}>Add Exam Date</Text>
            </TouchableOpacity>
          </Link>
          <Link href={'/admin/class-add' as any} asChild>
            <TouchableOpacity style={styles.adminChip}>
              <Text style={styles.adminChipText}>Add Class</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : null}
      {role === 'student' ? (
        <View style={styles.studentBar}>
          <Link href={'/student/register' as any} asChild>
            <TouchableOpacity style={styles.studentChip}>
              <Text style={styles.studentChipText}>Student Registration</Text>
            </TouchableOpacity>
          </Link>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  logo: {
    width: 72,
    height: 72,
    resizeMode: 'contain',
  },
  brand: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.text,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 12,
    color: Colors.light.icon,
    marginTop: 2,
  },
  loginBtn: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
  },
  authBox: {
    alignItems: 'flex-end',
    gap: 6,
  },
  adminBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  adminLabel: {
    fontSize: 12,
    color: Colors.light.icon,
    fontWeight: '600',
  },
  adminChip: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  adminChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  studentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  studentChip: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  studentChipText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  welcome: {
    fontSize: 12,
    color: Colors.light.icon,
  },
  loginText: {
    color: '#fff',
    fontWeight: '700',
  },
});
