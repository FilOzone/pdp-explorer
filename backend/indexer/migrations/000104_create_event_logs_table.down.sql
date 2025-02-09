-- Drop event logs table and all dependent objects
DROP INDEX IF EXISTS idx_event_logs_topics;
DROP INDEX IF EXISTS idx_event_logs_block_number;
DROP INDEX IF EXISTS idx_event_logs_name;
DROP INDEX IF EXISTS idx_event_logs_address;
DROP INDEX IF EXISTS idx_event_logs_set_id;
DROP TABLE IF EXISTS event_logs;