-- Apply after the exact release requests/webapp/schema.sql in each dedicated YOLO-owned client ledger.
CREATE TABLE IF NOT EXISTS yolo_feedback_service_budget(day INTEGER PRIMARY KEY,used INTEGER NOT NULL CHECK(used>0));
