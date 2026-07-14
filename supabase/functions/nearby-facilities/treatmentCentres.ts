/**
 * Curated NCDC-designated treatment centres.
 *
 * SAFETY CONTRACT: every entry here is a real, verifiable, NCDC/WHO-attributed
 * treatment centre. No fabricated facilities. Navigation for these centres is
 * routed by authoritative place NAME (`directionsQuery`) rather than by the
 * stored coordinates, so Google Maps resolves the exact verified place even if
 * the marker coordinate is only city-accurate. Phone numbers are included ONLY
 * when verifiable; otherwise omitted (never invented).
 *
 * Lassa fever: the three primary NCDC-designated case-management centres
 * (operational in Edo, Ondo, Ebonyi). Sources: NCDC Lassa case-management
 * guidance + WHO Disease Outbreak News.
 *
 * Cholera: treatment during outbreaks is delivered through ad-hoc Cholera
 * Treatment Centres (CTCs) that are stood up per-outbreak — there is no stable
 * NCDC-published permanent list, so we intentionally keep this empty and let
 * the broadened hospital search serve those users instead of guessing.
 */

export interface TreatmentCentre {
  id: string;
  name: string;
  state: string;
  latitude: number;
  longitude: number;
  description: string;
  /** Authoritative Google Maps directions destination (resolves the exact place). */
  directionsQuery: string;
  phone?: string;
  /** Attribution shown to the user. */
  source: string;
}

const CENTRES: Record<string, TreatmentCentre[]> = {
  lassa: [
    {
      id: 'ncdc-lassa-isth-edo',
      name: 'Irrua Specialist Teaching Hospital (ISTH)',
      state: 'Edo',
      latitude: 6.7376,
      longitude: 6.2103,
      description:
        'NCDC-designated Lassa fever treatment centre and national reference laboratory (Institute of Lassa Fever Research & Control).',
      directionsQuery: 'Irrua Specialist Teaching Hospital, Irrua, Edo State, Nigeria',
      source: 'NCDC-designated Lassa fever treatment centre',
    },
    {
      id: 'ncdc-lassa-fmc-owo-ondo',
      name: 'Federal Medical Centre, Owo (FMC Owo)',
      state: 'Ondo',
      latitude: 7.1962,
      longitude: 5.5936,
      description: 'NCDC-designated Lassa fever treatment centre serving the South-West.',
      directionsQuery: 'Federal Medical Centre Owo, Ondo State, Nigeria',
      source: 'NCDC-designated Lassa fever treatment centre',
    },
    {
      id: 'ncdc-lassa-fetha-ebonyi',
      name: 'Federal Teaching Hospital, Abakaliki (AE-FUTHA)',
      state: 'Ebonyi',
      latitude: 6.3249,
      longitude: 8.1137,
      description: 'NCDC-designated Lassa fever treatment centre serving the South-East.',
      directionsQuery:
        'Alex Ekwueme Federal University Teaching Hospital Abakaliki, Ebonyi State, Nigeria',
      source: 'NCDC-designated Lassa fever treatment centre',
    },
  ],
  // Cholera CTCs are ad-hoc per-outbreak; no stable NCDC list to cite here.
  cholera: [],
};

/** Return curated NCDC treatment centres for a disease key (empty if none). */
export function getTreatmentCentres(disease: string | null | undefined): TreatmentCentre[] {
  if (!disease) return [];
  return CENTRES[disease.trim().toLowerCase()] ?? [];
}
