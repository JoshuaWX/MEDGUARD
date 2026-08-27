-- The first ingestion implementation read category links from NCDC's index.
-- They are not individual reports, so remove only those placeholder rows before
-- the corrected PDF-report parser runs.
delete from public.health_posts
where external_id like 'ncdc:https://www.ncdc.gov.ng/diseases/sitreps%'
  and source = 'NCDC';
