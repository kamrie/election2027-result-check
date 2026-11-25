CREATE TABLE IF NOT EXISTS submission_removals (
  submission_id INT NOT NULL PRIMARY KEY,
  reviewed_by INT NOT NULL,
  reason ENUM('FAKE', 'DUPLICATE') NOT NULL,
  previous_status ENUM('PENDING', 'FLAGGED') NOT NULL,
  removed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB;
