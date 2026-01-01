/**
 * useSymptoms hook
 * Symptom logging functionality
 */

import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

interface UseSymptomReturn {
  logSymptoms: (symptoms: string[]) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

export const useSymptoms = (): UseSymptomReturn => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const logSymptoms = useCallback(async (symptoms: string[]) => {
    if (!user?.id) {
      throw new Error('User not authenticated');
    }

    if (symptoms.length === 0) {
      throw new Error('No symptoms provided');
    }

    try {
      setLoading(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('symptom_logs')
        .insert({
          user_id: user.id,
          symptoms,
        });

      if (insertError) throw insertError;

      // Optionally trigger risk analysis
      // This could call your RAG API to analyze symptoms
      await analyzeSymptoms(symptoms, user.id);

    } catch (err) {
      console.error('Error logging symptoms:', err);
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    logSymptoms,
    loading,
    error,
  };
};

// Analyze symptoms and update risk snapshot
async function analyzeSymptoms(symptoms: string[], userId: string): Promise<void> {
  try {
    // Calculate risk score based on symptoms
    const riskScore = calculateRiskScore(symptoms);
    
    // Store risk snapshot
    await supabase.from('risk_snapshots').insert({
      user_id: userId,
      symptoms,
      risk_score: riskScore,
      analysis: getAnalysis(symptoms),
    });

    // Update user's health score
    const newHealthScore = Math.max(0, 100 - riskScore);
    await supabase
      .from('profiles')
      .update({ health_score: newHealthScore })
      .eq('id', userId);

  } catch (err) {
    console.error('Error analyzing symptoms:', err);
    // Don't throw - analysis failure shouldn't block symptom logging
  }
}

// Calculate risk score based on symptoms
function calculateRiskScore(symptoms: string[]): number {
  const riskWeights: Record<string, number> = {
    fever: 20,
    headache: 10,
    fatigue: 8,
    cough: 12,
    bodyPain: 10,
    nausea: 12,
    dizziness: 15,
    chills: 18,
  };

  let totalRisk = 0;
  for (const symptom of symptoms) {
    totalRisk += riskWeights[symptom] || 5;
  }

  // Multiple symptoms increase risk
  if (symptoms.length >= 3) {
    totalRisk *= 1.2;
  }
  if (symptoms.length >= 5) {
    totalRisk *= 1.3;
  }

  return Math.min(100, Math.round(totalRisk));
}

// Generate analysis text
function getAnalysis(symptoms: string[]): string {
  if (symptoms.length === 0) {
    return 'No symptoms reported.';
  }

  const hasFebrileSymptoms = symptoms.some(s => 
    ['fever', 'chills', 'bodyPain'].includes(s)
  );

  if (hasFebrileSymptoms && symptoms.length >= 3) {
    return 'Your symptoms may indicate a fever-related illness. Consider getting tested for malaria or other infections. Seek medical attention if symptoms persist or worsen.';
  }

  if (symptoms.includes('cough') && symptoms.includes('fever')) {
    return 'Your symptoms may indicate a respiratory infection. Rest, stay hydrated, and monitor your temperature. Seek medical attention if you have difficulty breathing.';
  }

  return 'Based on your symptoms, we recommend rest and hydration. Monitor your condition and seek medical attention if symptoms worsen.';
}
