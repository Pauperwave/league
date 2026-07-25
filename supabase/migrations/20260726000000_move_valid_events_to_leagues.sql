-- ADR-026: "eventi validi" (minimum events counted toward the final
-- standings) is a season-length property of the league, not a scoring-rules
-- property of the ruleset. A ruleset is shared by many leagues
-- (leagues.ruleset_id, many-to-one) that can each run a different number of
-- events, so rule_set_valid_events forced every league on a shared ruleset
-- to the same threshold. Move it to leagues.valid_events, backfilling from
-- whatever ruleset each league currently uses (the field isn't wired into
-- standings computation yet, so this only preserves the previously
-- configured value).

ALTER TABLE leagues ADD COLUMN valid_events integer;

UPDATE leagues
SET valid_events = rulesets.rule_set_valid_events
FROM rulesets
WHERE leagues.ruleset_id = rulesets.ruleset_id;

ALTER TABLE rulesets DROP COLUMN rule_set_valid_events;
