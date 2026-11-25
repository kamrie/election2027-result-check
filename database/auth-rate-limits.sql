CREATE TABLE IF NOT EXISTS auth_rate_limits (
  bucket_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (bucket_key, expires_at),
  KEY idx_auth_rate_limits_expiry (expires_at)
) ENGINE=InnoDB;
