import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function StudentRegisterScreen() {
  const { width } = useWindowDimensions();
  const isWide = width >= 900;

  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regNo, setRegNo] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState<number | null>(null);
  const [captchaInput, setCaptchaInput] = useState('');
  const [form, setForm] = useState({
    full_name: '',
    dob: new Date(),
    mobile: '',
    email: '',
    father_name: '',
    mother_name: '',
    address: '',
  });

  const selectedClassNumber = useMemo(() => {
    if (!selectedClassId) return null;
    const found = classes.find((c) => c.id === selectedClassId);
    const num = Number(String(found?.name ?? ''));
    if (!Number.isFinite(num) || num <= 0) return null;
    return Math.trunc(num);
  }, [classes, selectedClassId]);

  const formattedDob = useMemo(() => {
    return form.dob.toISOString().split('T')[0];
  }, [form.dob]);

  const handleDobChange = (value: string) => {
    const next = new Date(value);
    if (!Number.isNaN(next.getTime())) {
      setForm((prev) => ({ ...prev, dob: next }));
    }
  };

  useEffect(() => {
    const generateCaptcha = () => {
      const a = Math.floor(Math.random() * 9) + 1;
      const b = Math.floor(Math.random() * 9) + 1;
      setCaptchaQuestion(`${a} + ${b} = ?`);
      setCaptchaAnswer(a + b);
      setCaptchaInput('');
    };
    const fetchClasses = async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('status', 'active')
        .order('name', { ascending: true });
      setClasses(data ?? []);
    };
    const fetchUserDetails = async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? '';
      const fallbackName =
        (data.user?.user_metadata as any)?.full_name ??
        (data.user?.user_metadata as any)?.display_name ??
        '';

      let profileName = '';
      if (data.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.user.id)
          .maybeSingle();
        profileName = profile?.full_name ?? '';
      }

      setForm((prev) => ({
        ...prev,
        email,
        full_name: prev.full_name || profileName || fallbackName,
      }));
    };
    fetchClasses();
    fetchUserDetails();
    generateCaptcha();
  }, []);

  useEffect(() => {
    const generateIdsForClass = async () => {
      if (!selectedClassId || !selectedClassNumber) {
        setRegNo('');
        setRollNo('');
        return;
      }

      const yearPrefix = new Date().getFullYear().toString();
      const class2 = String(selectedClassNumber).padStart(2, '0');
      const regPrefix = `${yearPrefix}${class2}`;

      const { data: lastReg } = await supabase
        .from('students')
        .select('registration_no')
        .like('registration_no', `${regPrefix}%`)
        .order('registration_no', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastRegNo = lastReg?.registration_no ?? '';
      const lastRegSeq = Number(lastRegNo.slice(6)) || 0;
      const nextRegSeq = (lastRegSeq + 1).toString().padStart(6, '0');
      setRegNo(`${regPrefix}${nextRegSeq}`);

      const rollPrefix = String(selectedClassNumber);
      const { data: lastRoll } = await supabase
        .from('students')
        .select('roll_no')
        .eq('class_id', selectedClassId)
        .like('roll_no', `${rollPrefix}%`)
        .order('roll_no', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastRollNo = lastRoll?.roll_no ?? '';
      const lastRollSeq = Number(lastRollNo.slice(rollPrefix.length)) || 0;
      const nextRollSeq = (lastRollSeq + 1).toString().padStart(2, '0');
      setRollNo(`${rollPrefix}${nextRollSeq}`);
    };

    generateIdsForClass();
  }, [selectedClassId, selectedClassNumber]);

  const handleRegister = async () => {
    const captchaOk = Number(captchaInput.trim()) === (captchaAnswer ?? Number.NaN);
    if (!captchaOk) {
      setError('Captcha incorrect. Please solve the captcha.');
      return;
    }

    if (!regNo.trim() || !rollNo.trim() || !form.full_name.trim() || !selectedClassId) {
      setError(!form.full_name.trim() ? 'Name required.' : 'Class required.');
      return;
    }
    setSaving(true);
    setError(null);
    setStatus('');

    const trimmedEmail = form.email.trim();
    const trimmedMobile = form.mobile.trim();
    const normalizedMobile = trimmedMobile ? trimmedMobile.replace(/\D/g, '') : '';
    if (normalizedMobile) {
      if (normalizedMobile.length !== 10) {
        setError('Wrong mobile number. Mobile 10 digit ka hona chahiye.');
        setSaving(false);
        return;
      }
    }

    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .or(`registration_no.eq.${regNo.trim()},roll_no.eq.${rollNo.trim()}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      setError('Registration number already exists.');
      setSaving(false);
      return;
    }

    if (trimmedEmail || trimmedMobile) {
      const checks: string[] = [];
      if (trimmedEmail) checks.push(`email.eq.${trimmedEmail}`);
      if (normalizedMobile) checks.push(`mobile.eq.${normalizedMobile}`);

      const { data: existingContact, error: contactError } = await supabase
        .from('students')
        .select('id, email, mobile')
        .or(checks.join(','))
        .limit(1)
        .maybeSingle();

      if (contactError) {
        setError(contactError.message);
        setSaving(false);
        return;
      }

      if (existingContact) {
        if (trimmedEmail && existingContact.email === trimmedEmail) {
          setError('Email already exists.');
        } else if (trimmedMobile && existingContact.mobile === trimmedMobile) {
          setError('Mobile number already exists.');
        } else {
          setError('Email or mobile already exists.');
        }
        setSaving(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from('students').insert({
      registration_no: regNo.trim(),
      roll_no: rollNo.trim(),
      full_name: form.full_name.trim(),
      father_name: form.father_name.trim() || null,
      mother_name: form.mother_name.trim() || null,
      address: form.address.trim() || null,
      dob: formattedDob || null,
      mobile: normalizedMobile || null,
      email: trimmedEmail || null,
      class_id: selectedClassId,
      status: 'active',
    });

    if (insertError) {
      setError(insertError.message);
    } else {
      setStatus(`Registration saved successfully. Reg No: ${regNo} • Roll No: ${rollNo}`);
      await sendRegistrationEmail();
      setForm((prev) => ({
        ...prev,
        full_name: '',
        dob: new Date(),
        mobile: '',
        father_name: '',
        mother_name: '',
        address: '',
      }));
      setSelectedClassId('');
    }
    setSaving(false);
  };

  const sendRegistrationEmail = async () => {
    setEmailStatus('sending');
    setEmailError(null);
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

      if (!supabaseUrl || !anonKey) {
        setEmailStatus('failed');
        setEmailError('Supabase config missing. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
        return;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/send-registration-email`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: form.email.trim(),
          fullName: form.full_name.trim(),
          registrationNo: regNo,
          rollNo,
        }),
      });

      const rawText = await res.text();
      let parsed: any = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!res.ok) {
        const baseMessage = parsed?.error || parsed?.message || 'Email send failed.';
        const message = [baseMessage, `status=${res.status}`, rawText ? `body=${rawText}` : null].filter(Boolean).join(' • ');
        setEmailStatus('failed');
        setEmailError(message);
        return;
      }

      if (parsed?.error) {
        setEmailStatus('failed');
        setEmailError(parsed.error);
        return;
      }

      setEmailStatus('sent');
    } catch {
      setEmailStatus('failed');
      setEmailError('Email send failed.');
    }
  };

  const handleRetryEmail = async () => {
    await sendRegistrationEmail();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Student Registration</Text>
      <Text style={styles.subtitle}>Fill your details to register.</Text>

      <View style={[styles.formCard, Platform.OS === 'web' && isWide && styles.formCardHalf]}>
        <TextInput
          placeholder="Full Name"
          style={styles.input}
          value={form.full_name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, full_name: value }))}
        />

        <TextInput
          placeholder="Father Name"
          style={styles.input}
          value={form.father_name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, father_name: value }))}
        />

        <TextInput
          placeholder="Mother Name"
          style={styles.input}
          value={form.mother_name}
          onChangeText={(value) => setForm((prev) => ({ ...prev, mother_name: value }))}
        />

        <TextInput
          placeholder="Address"
          style={[styles.input, styles.inputMultiline]}
          value={form.address}
          multiline
          numberOfLines={2}
          onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
        />

        <View style={styles.pickerWrap}>
          <Text style={styles.pickerLabel}>Class</Text>
          <Picker selectedValue={selectedClassId} onValueChange={(value) => setSelectedClassId(String(value))}>
            <Picker.Item label="Select class" value="" />
            {classes.map((item) => (
              <Picker.Item key={item.id} label={item.name} value={item.id} />
            ))}
          </Picker>
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.dateLabel}>DOB</Text>
          {Platform.OS === 'web' ? (
            <input
              type="date"
              value={formattedDob}
              onChange={(e) => handleDobChange(e.target.value)}
              style={{
                padding: '10px 12px',
                borderRadius: '12px',
                border: `1px solid ${Colors.light.border}`,
                backgroundColor: Colors.light.surface,
                fontSize: '16px',
                fontFamily: 'Times New Roman',
                color: Colors.light.text,
                cursor: 'pointer',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                display: 'block',
              }}
            />
          ) : (
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDobPicker(true)}>
              <Text style={styles.dateButtonText}>{formattedDob}</Text>
            </TouchableOpacity>
          )}
        </View>
        {Platform.OS !== 'web' && showDobPicker ? (
          <DateTimePicker
            value={form.dob}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              setShowDobPicker(false);
              if (selected) {
                setForm((prev) => ({ ...prev, dob: selected }));
              }
            }}
          />
        ) : null}

        <TextInput
          placeholder="Mobile"
          style={styles.input}
          keyboardType="phone-pad"
          value={form.mobile}
          onChangeText={(value) => setForm((prev) => ({ ...prev, mobile: value }))}
        />
        <TextInput
          placeholder="Email"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
          value={form.email}
          editable={false}
        />

        <View style={styles.captchaRow}>
          <Text style={styles.captchaLabel}>{`Captcha: ${captchaQuestion}`}</Text>
          <TextInput
            placeholder="Answer"
            style={styles.input}
            keyboardType="numeric"
            value={captchaInput}
            onChangeText={setCaptchaInput}
          />
        </View>
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
      {emailStatus === 'sending' ? <Text style={styles.status}>Sending email...</Text> : null}
      {emailStatus === 'sent' ? <Text style={styles.status}>Email sent successfully.</Text> : null}
      {emailStatus === 'failed' ? (
        <View style={styles.retryRow}>
          <Text style={styles.errorText}>{emailError ? `Email failed: ${emailError}` : 'Email failed. Please retry.'}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleRetryEmail}>
            <Text style={styles.retryText}>Retry Email</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.actionWrap, Platform.OS === 'web' && isWide && styles.actionWrapHalf]}>
        <TouchableOpacity style={styles.cta} onPress={handleRegister} disabled={saving}>
          <Text style={styles.ctaText}>{saving ? 'Saving...' : 'Register'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { padding: 20, gap: 12, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: Colors.light.text, fontFamily: 'Times New Roman' },
  subtitle: { color: Colors.light.icon, fontFamily: 'Times New Roman' },
  formCard: {
    backgroundColor: Colors.light.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: 14,
    gap: 12,
    width: '100%',
    maxWidth: 720,
    overflow: 'hidden',
  },
  formCardHalf: {
    width: '50%',
    minWidth: 360,
    maxWidth: 720,
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
  inputMultiline: {
    textAlignVertical: 'top',
    minHeight: 70,
  },
  pickerWrap: { backgroundColor: Colors.light.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border, paddingHorizontal: 6 },
  pickerLabel: { fontSize: 12, color: Colors.light.icon, marginTop: 8, marginLeft: 6, fontWeight: '600', fontFamily: 'Times New Roman' },
  dateRow: { gap: 6 },
  dateLabel: { color: Colors.light.icon, fontWeight: '600', fontFamily: 'Times New Roman' },
  dateButton: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dateInput: {
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  dateButtonText: { color: Colors.light.text, fontWeight: '600', fontFamily: 'Times New Roman' },
  actionWrap: { width: '100%', maxWidth: 720 },
  actionWrapHalf: { width: '50%', minWidth: 360, maxWidth: 720 },
  cta: { width: '100%', backgroundColor: Colors.light.tint, padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  ctaText: { color: '#fff', fontWeight: '700', fontFamily: 'Times New Roman' },
  status: { color: Colors.light.accent, fontWeight: '600', fontFamily: 'Times New Roman' },
  errorText: { color: '#b3261e', fontWeight: '600', fontFamily: 'Times New Roman' },
  retryRow: { gap: 8 },
  retryBtn: { alignSelf: 'flex-start', backgroundColor: Colors.light.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: Colors.light.border },
  retryText: { color: Colors.light.text, fontWeight: '700', fontFamily: 'Times New Roman' },
  captchaRow: { gap: 8 },
  captchaLabel: { color: Colors.light.icon, fontWeight: '600', fontFamily: 'Times New Roman' },
});
