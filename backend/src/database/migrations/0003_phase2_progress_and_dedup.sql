ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS respondent_key VARCHAR(120);

CREATE INDEX IF NOT EXISTS idx_responses_publication_respondent_status
  ON responses(publication_id, respondent_key, status);
