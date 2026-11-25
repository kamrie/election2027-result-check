CREATE TABLE IF NOT EXISTS submission_photo_hashes (
  submission_id INT NOT NULL,
  photo_position TINYINT UNSIGNED NOT NULL,
  polling_unit_id INT NOT NULL,
  sha256 BINARY(32) NOT NULL,
  perceptual_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  match_kind ENUM('EXACT', 'NEAR') DEFAULT NULL,
  matched_submission_id INT DEFAULT NULL,
  PRIMARY KEY (submission_id, photo_position),
  KEY idx_photo_hash_unit_sha256 (polling_unit_id, sha256),
  KEY idx_photo_hash_review (match_kind, submission_id),
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
  FOREIGN KEY (polling_unit_id) REFERENCES polling_units(id),
  FOREIGN KEY (matched_submission_id) REFERENCES submissions(id) ON DELETE SET NULL
) ENGINE=InnoDB;
