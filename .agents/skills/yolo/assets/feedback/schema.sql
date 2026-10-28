-- Add to the client-owned app/session database; no existing tables are replaced.
CREATE TABLE IF NOT EXISTS yolo_feedback_requests (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, title TEXT NOT NULL,
 payload TEXT NOT NULL, digest TEXT NOT NULL, created INTEGER NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('staged','writing','sent','rejected')),
 issue INTEGER
);
CREATE INDEX IF NOT EXISTS yolo_feedback_owner ON yolo_feedback_requests(owner,created);
CREATE TABLE IF NOT EXISTS yolo_feedback_replies (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, owner TEXT NOT NULL,
 payload TEXT NOT NULL, digest TEXT NOT NULL, created INTEGER NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('staged','writing','sent','rejected')),
 comment INTEGER
);
CREATE INDEX IF NOT EXISTS yolo_feedback_reply_owner ON yolo_feedback_replies(request_id,owner,created);
CREATE TABLE IF NOT EXISTS yolo_feedback_responses (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL, actor TEXT NOT NULL,
 payload TEXT NOT NULL, digest TEXT NOT NULL, created INTEGER NOT NULL,
 phase TEXT NOT NULL CHECK(phase IN ('staged','writing','sent','rejected')),
 comment INTEGER
);
CREATE INDEX IF NOT EXISTS yolo_feedback_response_actor ON yolo_feedback_responses(request_id,actor,created);
CREATE TABLE IF NOT EXISTS yolo_feedback_bridge_identity (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1), repository TEXT NOT NULL
);
-- The client owner seeds the one trusted repository during the reviewed migration.
-- Never infer/rebind it from incoming requests or a changed runtime setting.
