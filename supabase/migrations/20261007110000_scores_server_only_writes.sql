-- Scores are now written by the Vercel function (api/submit-score.js) using the
-- secret key, which bypasses row level security. Browsers keep read access only.
drop policy "Anyone can submit a score" on public.scores;

revoke insert, update, delete, truncate on public.scores from anon, authenticated;
