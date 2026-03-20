-- Add columns for org-change approval workflow
ALTER TABLE donations ADD COLUMN proposed_org_id INT DEFAULT NULL;
ALTER TABLE donations ADD COLUMN original_org_id INT DEFAULT NULL;
