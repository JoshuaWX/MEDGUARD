/**
 * CycleTrackerScreen — opt-in menstrual cycle tracker.
 *
 * Shows current phase, next-period and fertile-window estimates, lets the user
 * log periods (flow + symptoms), and adjust typical cycle/period lengths.
 * Awareness/wellness only — estimates are not a medical or contraceptive
 * guarantee. Data is private to the user.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useCycle } from '../hooks/useCycle';
import { useUser } from '../hooks/useUser';
import { useTheme } from '../hooks/useTheme';
import { useFeedback, Icon } from '../components';
import { PHASE_LABEL, type FlowIntensity } from '../services/cycle';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';

const SYMPTOM_OPTIONS = ['cramps', 'bloating', 'headache', 'mood swings', 'fatigue', 'tender breasts', 'acne', 'nausea'];
const FLOWS: FlowIntensity[] = ['light', 'normal', 'heavy'];

function fmt(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const CycleTrackerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { toast } = useFeedback();
  const { user, refresh: refreshUser } = useUser();
  const { loading, logs, settings, prediction, logPeriod, updateSettings, setEnabled } = useCycle();

  const [enabled, setLocalEnabled] = useState(false);
  useEffect(() => { setLocalEnabled(Boolean(user?.cycleTrackingEnabled)); }, [user?.cycleTrackingEnabled]);

  const [logOpen, setLogOpen] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [flow, setFlow] = useState<FlowIntensity>('normal');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const phaseTint = useMemo(() => {
    switch (prediction.phase) {
      case 'menstrual': return Colors.danger;
      case 'ovulation': return Colors.emerald;
      case 'luteal': return '#8b5cf6';
      case 'follicular': return Colors.primary;
      default: return colors.textMuted;
    }
  }, [prediction.phase, colors.textMuted]);

  const enableTracking = async () => {
    await setEnabled(true);
    setLocalEnabled(true);
    await refreshUser();
  };

  const toggleSymptom = (s: string) =>
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const submitLog = async () => {
    await logPeriod({
      startDate: startDate.toISOString().slice(0, 10),
      flowIntensity: flow,
      symptoms,
      notes: notes.trim() || null,
    });
    setLogOpen(false);
    setSymptoms([]); setNotes(''); setFlow('normal');
    toast({ tone: 'success', title: 'Period logged', message: 'Your cycle estimates have been updated.' });
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
      <Pressable onPress={() => navigation.goBack()} style={[styles.headerBtn, styles.headerTile, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]} hitSlop={10}>
        <Icon name="chevron-left" size={22} color={colors.text} />
      </Pressable>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Cycle Tracker</Text>
      <View style={styles.headerBtn} />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </View>
    );
  }

  if (!enabled) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {header}
        <View style={styles.center}>
          <Icon name="flower" size={40} color={colors.primary} />
          <Text style={[styles.enableTitle, { color: colors.text }]}>Track your cycle</Text>
          <Text style={[styles.enableBody, { color: colors.textSecondary }]}>
            Log your periods to see your current phase, your next estimated period, and your fertile window.
            This is private to you and used for awareness only — not medical or contraceptive advice.
          </Text>
          <Pressable onPress={enableTracking} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Text style={styles.primaryBtnText}>Enable cycle tracking</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {header}
      <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: insets.bottom + 40, gap: Spacing.base }} showsVerticalScrollIndicator={false}>
        {/* Phase + key dates */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.phaseRow}>
            <View style={[styles.phaseDot, { backgroundColor: phaseTint }]} />
            <Text style={[styles.phaseLabel, { color: colors.text }]}>{PHASE_LABEL[prediction.phase]}</Text>
          </View>
          {prediction.dayOfCycle != null && (
            <Text style={[styles.muted, { color: colors.textSecondary }]}>Day {prediction.dayOfCycle} of your cycle</Text>
          )}
          <View style={styles.statGrid}>
            <Stat label="Next period" value={fmt(prediction.nextPeriodStart)} sub={prediction.daysUntilNextPeriod != null ? `in ${prediction.daysUntilNextPeriod} day(s)` : ''} colors={colors} />
            <Stat label="Fertile window" value={`${fmt(prediction.fertileWindowStart)}–${fmt(prediction.fertileWindowEnd)}`} sub="estimated" colors={colors} />
          </View>
          <Pressable onPress={() => { setStartDate(new Date()); setLogOpen(true); }} style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: Spacing.sm }]}>
            <Icon name="plus" size={18} color={Colors.textLight} />
            <Text style={styles.primaryBtnText}>Log a period</Text>
          </Pressable>
        </View>

        {/* Typical lengths */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your averages</Text>
          <Stepper label="Cycle length" value={settings.avgCycleLength} min={18} max={45} suffix="days"
            onChange={(v) => updateSettings({ ...settings, avgCycleLength: v })} colors={colors} />
          <Stepper label="Period length" value={settings.avgPeriodLength} min={2} max={10} suffix="days"
            onChange={(v) => updateSettings({ ...settings, avgPeriodLength: v })} colors={colors} />
          <View style={styles.switchRow}>
            <Text style={[styles.muted, { color: colors.text }]}>Period reminders</Text>
            <Switch
              value={settings.remindersEnabled}
              onValueChange={(v) => updateSettings({ ...settings, remindersEnabled: v })}
              trackColor={{ false: colors.border, true: Colors.primaryLight }}
              thumbColor={settings.remindersEnabled ? Colors.primary : colors.textMuted}
            />
          </View>
        </View>

        {/* History */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>History</Text>
          {logs.length === 0 ? (
            <Text style={[styles.muted, { color: colors.textSecondary }]}>No periods logged yet.</Text>
          ) : (
            logs.map((l) => (
              <View key={l.id} style={[styles.logRow, { borderColor: colors.border }]}>
                <View style={styles.logDot} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.logDate, { color: colors.text }]}>{fmt(l.startDate)}{l.endDate ? `–${fmt(l.endDate)}` : ''}</Text>
                  <Text style={[styles.muted, { color: colors.textMuted }]}>
                    {l.flowIntensity ? `${l.flowIntensity} flow` : 'flow not set'}{l.symptoms.length ? ` · ${l.symptoms.join(', ')}` : ''}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
          Estimates are based on your logged history and typical averages. They are for awareness only and
          are not a medical or contraceptive guarantee.
        </Text>
      </ScrollView>

      {/* Log modal */}
      <Modal visible={logOpen} transparent animationType="slide" onRequestClose={() => setLogOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setLogOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, paddingBottom: insets.bottom + Spacing.xl }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Log a period</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Start date</Text>
            <Pressable onPress={() => setShowPicker(true)} style={[styles.dateBtn, { borderColor: colors.border }]}>
              <Icon name="calendar" size={16} color={colors.primary} />
              <Text style={[styles.dateText, { color: colors.text }]}>{startDate.toDateString()}</Text>
            </Pressable>
            {showPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                maximumDate={new Date()}
                onChange={(_e, d) => { setShowPicker(Platform.OS === 'ios'); if (d) setStartDate(d); }}
              />
            )}

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Flow</Text>
            <View style={styles.segRow}>
              {FLOWS.map((f) => (
                <Pressable key={f} onPress={() => setFlow(f)} style={[styles.seg, { borderColor: flow === f ? Colors.primary : colors.border, backgroundColor: flow === f ? Colors.primary : 'transparent' }]}>
                  <Text style={[styles.segText, { color: flow === f ? Colors.textLight : colors.textSecondary }]}>{f}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Symptoms</Text>
            <View style={styles.chipWrap}>
              {SYMPTOM_OPTIONS.map((s) => {
                const on = symptoms.includes(s);
                return (
                  <Pressable key={s} onPress={() => toggleSymptom(s)} style={[styles.chip, { borderColor: on ? Colors.primary : colors.border, backgroundColor: on ? Colors.primaryLight : 'transparent' }]}>
                    <Text style={[styles.chipText, { color: on ? Colors.primary : colors.textSecondary }]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={colors.textMuted}
              style={[styles.notes, { borderColor: colors.border, color: colors.text }]}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable onPress={() => setLogOpen(false)} style={styles.cancelBtn}>
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitLog} style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <Text style={styles.primaryBtnText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string; colors: any }> = ({ label, value, sub, colors }) => (
  <View style={styles.stat}>
    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
    {!!sub && <Text style={[styles.statSub, { color: colors.textMuted }]}>{sub}</Text>}
  </View>
);

const Stepper: React.FC<{ label: string; value: number; min: number; max: number; suffix: string; onChange: (v: number) => void; colors: any }> = ({ label, value, min, max, suffix, onChange, colors }) => (
  <View style={styles.switchRow}>
    <Text style={[styles.muted, { color: colors.text }]}>{label}</Text>
    <View style={styles.stepper}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} style={[styles.stepBtn, { borderColor: colors.border }]}><Icon name="minus" size={16} color={colors.text} /></Pressable>
      <Text style={[styles.stepVal, { color: colors.text }]}>{value} {suffix}</Text>
      <Pressable onPress={() => onChange(Math.min(max, value + 1))} style={[styles.stepBtn, { borderColor: colors.border }]}><Icon name="plus" size={16} color={colors.text} /></Pressable>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTile: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontFamily: FontFamily.display, fontSize: FontSize.lg, letterSpacing: -0.2, flex: 1, textAlign: 'center', paddingRight: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  enableTitle: { fontFamily: FontFamily.displayBold, fontSize: FontSize.xl, letterSpacing: -0.3 },
  enableBody: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  card: { borderRadius: BorderRadius.card, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.sm },
  phaseRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phaseDot: { width: 12, height: 12, borderRadius: 6 },
  phaseLabel: { fontFamily: FontFamily.display, fontSize: FontSize.lg, letterSpacing: -0.2 },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  statGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  stat: { flex: 1 },
  statLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  statValue: { fontFamily: FontFamily.displayBold, fontSize: FontSize.base, letterSpacing: -0.2, marginTop: 2 },
  statSub: { fontFamily: FontFamily.regular, fontSize: FontSize.xs },
  sectionTitle: { fontFamily: FontFamily.display, fontSize: FontSize.base, letterSpacing: -0.2, marginBottom: 2 },
  logDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, minWidth: 56, textAlign: 'center' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm },
  logDate: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: BorderRadius.xl, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  primaryBtnText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, color: Colors.textLight },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic', lineHeight: 16, paddingHorizontal: Spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(3,15,20,0.64)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: BorderRadius['2xl'], borderTopRightRadius: BorderRadius['2xl'], borderWidth: 1, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, gap: Spacing.sm, maxHeight: '88%' },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, marginTop: Spacing.sm },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md },
  dateText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  segRow: { flexDirection: 'row', gap: Spacing.sm },
  seg: { flex: 1, borderWidth: 1, borderRadius: BorderRadius.lg, paddingVertical: Spacing.sm, alignItems: 'center' },
  segText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, textTransform: 'capitalize' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  chipText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  notes: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.base, minHeight: 64, fontFamily: FontFamily.regular, fontSize: FontSize.sm, marginTop: Spacing.sm, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
  cancelBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.base },
  cancelText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
});

export default CycleTrackerScreen;
