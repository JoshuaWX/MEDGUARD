/**
 * EnvironmentModal Component
 * Detailed view for AQI and Weather
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Spacing, Shadows, FontFamily, FontSize, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import { IntelV2 } from '../hooks/useIntel';
import { AQILevel } from './AQICard';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface EnvironmentModalProps {
  visible: boolean;
  onClose: () => void;
  data: IntelV2 | null;
  initialTab?: 'aqi' | 'weather';
}

const { width } = Dimensions.get('window');

const PollutantItem = ({ label, value, status, isDark }: { label: string; value: number | undefined; status?: string; isDark: boolean }) => {
  const themed = useThemedColors(isDark);
  if (value === undefined) return null;

  return (
    <View style={[styles.pollutantItem, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
      <Text style={[styles.pollutantLabel, { color: themed.textSecondary }]}>{label}</Text>
      <View style={styles.pollutantValueContainer}>
         <Text style={[styles.pollutantValue, { color: themed.text }]}>{value}</Text>
         {status && <Text style={[styles.pollutantStatus, { color: status === 'Good' ? Colors.success : Colors.warning }]}>{status}</Text>}
      </View>
    </View>
  );
};

export const EnvironmentModal: React.FC<EnvironmentModalProps> = ({
  visible,
  onClose,
  data,
  initialTab = 'aqi',
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const [activeTab, setActiveTab] = useState<'aqi' | 'weather'>(initialTab);

  if (!data) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          
          <Animated.View 
            entering={SlideInDown.springify().damping(15)}
            style={[styles.container, { backgroundColor: isDark ? themed.background : '#ffffff' }]}
          >
            {/* Handle Bar */}
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: isDark ? '#475569' : '#cbd5e1' }]} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: themed.text }]}>Environment Details</Text>
              <Pressable onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={28} color={themed.textSecondary} />
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={[styles.tabs, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }]}>
              <Pressable 
                style={[styles.tab, activeTab === 'aqi' && styles.activeTab, activeTab === 'aqi' && { backgroundColor: isDark ? '#334155' : '#ffffff' }]}
                onPress={() => setActiveTab('aqi')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'aqi' ? themed.text : themed.textSecondary }]}>Air Quality</Text>
              </Pressable>
              <Pressable 
                style={[styles.tab, activeTab === 'weather' && styles.activeTab, activeTab === 'weather' && { backgroundColor: isDark ? '#334155' : '#ffffff' }]}
                onPress={() => setActiveTab('weather')}
              >
                <Text style={[styles.tabText, { color: activeTab === 'weather' ? themed.text : themed.textSecondary }]}>Weather</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              
              {activeTab === 'aqi' && data.airQuality && (
                <Animated.View entering={FadeIn.duration(400)}>
                  {/* AQI Hero */}
                  <View style={styles.aqiHero}>
                    <View style={[styles.aqiGraph, { borderColor: getAQIColor(data.airQuality.insight.level) }]}>
                      <Text style={[styles.aqiValueBig, { color: themed.text }]}>{data.airQuality.aqi}</Text>
                      <Text style={[styles.aqiLabelBig, { color: themed.textSecondary }]}>Index</Text>
                    </View>
                    <Text style={[styles.aqiStatusBig, { color: getAQIColor(data.airQuality.insight.level) }]}>
                      {data.airQuality.insight.description}
                    </Text>
                    <Text style={[styles.aqiDesc, { color: themed.textSecondary }]}>
                      {data.airQuality.insight.healthImplications}
                    </Text>
                  </View>

                  <Text style={[styles.sectionTitle, { color: themed.text }]}>
                    {data.airQuality.insight?.dominantPollutant
                      ? `Pollutants (Primary: ${data.airQuality.insight.dominantPollutant})`
                      : 'Pollutants'}
                  </Text>
                  <View style={styles.pollutantGrid}>
                    <PollutantItem
                      label="PM2.5"
                      value={data.airQuality.insight?.pollutants?.pm2_5?.value}
                      status={data.airQuality.insight?.pollutants?.pm2_5?.status}
                      isDark={isDark}
                    />
                    <PollutantItem
                      label="PM10"
                      value={data.airQuality.insight?.pollutants?.pm10?.value}
                      status={data.airQuality.insight?.pollutants?.pm10?.status}
                      isDark={isDark}
                    />
                    <PollutantItem
                      label="CO"
                      value={data.airQuality.insight?.pollutants?.co?.value}
                      status={data.airQuality.insight?.pollutants?.co?.status}
                      isDark={isDark}
                    />
                    <PollutantItem
                      label="NO₂"
                      value={data.airQuality.insight?.pollutants?.no2?.value}
                      status={data.airQuality.insight?.pollutants?.no2?.status}
                      isDark={isDark}
                    />
                    <PollutantItem
                      label="O₃"
                      value={data.airQuality.insight?.pollutants?.o3?.value}
                      status={data.airQuality.insight?.pollutants?.o3?.status}
                      isDark={isDark}
                    />
                  </View>
                  
                  <Text style={[styles.sectionTitle, { color: themed.text, marginTop: 24 }]}>Recommendations</Text>
                  {data.airQuality.insight.recommendations.map((rec, i) => (
                    <View key={i} style={styles.recRow}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.primary} style={{ marginTop: 2 }} />
                      <Text style={[styles.recText, { color: themed.textSecondary }]}>{rec}</Text>
                    </View>
                  ))}
                </Animated.View>
              )}

              {activeTab === 'weather' && data.weather && (
                <Animated.View entering={FadeIn.duration(400)}>
                  {/* Current Weather */}
                  <View style={styles.weatherHero}>
                    <Ionicons name="partly-sunny" size={64} color={Colors.primary} />
                    <Text style={[styles.tempBig, { color: themed.text }]}>{Math.round(data.weather.current.temp)}°C</Text>
                    <Text style={[styles.weatherDesc, { color: themed.textSecondary }]}>{data.season?.label || 'Clear Sky'}</Text>
                    <View style={styles.weatherMetrics}>
                      <View style={styles.weatherMetric}>
                        <Ionicons name="water-outline" size={16} color={themed.textSecondary} />
                        <Text style={[styles.metricText, { color: themed.textSecondary }]}>{data.weather.current.humidity}% Humidity</Text>
                      </View>
                      <View style={styles.weatherMetric}>
                        <Ionicons name="speedometer-outline" size={16} color={themed.textSecondary} />
                        <Text style={[styles.metricText, { color: themed.textSecondary }]}>{data.weather.current.windSpeed} m/s Wind</Text>
                      </View>
                    </View>
                  </View>

                  {/* Forecast */}
                  <Text style={[styles.sectionTitle, { color: themed.text }]}>3-Day Forecast</Text>
                  {data.weather?.forecast?.dates.map((date, i) => (
                    <View key={i} style={[styles.forecastRow, { borderBottomColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <Text style={[styles.forecastDate, { color: themed.text }]}>
                        {new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                      </Text>
                      <View style={styles.forecastTemps}>
                        <Text style={[styles.maxTemp, { color: themed.text }]}>{Math.round(data.weather?.forecast?.maxTemps[i] ?? 0)}°</Text>
                        <Text style={[styles.minTemp, { color: themed.textSecondary }]}>{Math.round(data.weather?.forecast?.minTemps[i] ?? 0)}°</Text>
                      </View>
                      <View style={styles.precipContainer}>
                        <Ionicons name="rainy-outline" size={14} color={Colors.primary} />
                        <Text style={[styles.precipText, { color: Colors.primary }]}>{(data.weather?.forecast?.precipitation[i] ?? 0).toFixed(1)}mm</Text>
                      </View>
                    </View>
                  ))}
                </Animated.View>
              )}

            </ScrollView>
          </Animated.View>
        </View>
      </BlurView>
    </Modal>
  );
};

function getAQIColor(level: AQILevel) {
  switch (level) {
    case 'good': return '#10b981';
    case 'fair': return '#22c55e';
    case 'moderate': return '#f59e0b';
    case 'poor': return '#ef4444';
    case 'very_poor': return '#7c3aed';
    default: return '#9ca3af';
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  container: {
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    ...Shadows.modal,
  },
  handleContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
  },
  closeBtn: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    padding: 4,
    borderRadius: BorderRadius.lg,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  activeTab: {
    ...Shadows.sm,
  },
  tabText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  aqiHero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  aqiGraph: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  aqiValueBig: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
  },
  aqiLabelBig: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
  aqiStatusBig: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    marginBottom: 8,
  },
  aqiDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    textAlign: 'center',
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    marginBottom: 12,
  },
  pollutantGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pollutantItem: {
    width: '48%',
    padding: 12,
    borderRadius: BorderRadius.md,
  },
  pollutantLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    marginBottom: 4,
  },
  pollutantValueContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  pollutantValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
  },
  pollutantStatus: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  recRow: {
    flexDirection: 'row',
    marginBottom: 10,
    gap: 10,
  },
  recText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    flex: 1,
  },
  weatherHero: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 20,
  },
  tempBig: {
    fontFamily: FontFamily.bold,
    fontSize: 48,
    marginVertical: 8,
  },
  weatherDesc: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    marginBottom: 16,
    textTransform: 'capitalize',
  },
  weatherMetrics: {
    flexDirection: 'row',
    gap: 20,
  },
  weatherMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  forecastDate: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    width: 60,
  },
  forecastTemps: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  maxTemp: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
  },
  minTemp: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
  },
  precipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  precipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
});
