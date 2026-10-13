import sqlite3
import uuid
import datetime
import json

db_path = 'ai_surveillance.db'
conn = sqlite3.connect(db_path)
now = datetime.datetime.now(datetime.timezone.utc)
today_str = now.date().isoformat()

# 1. Seed Employees if empty
emp_count = conn.execute("SELECT COUNT(*) FROM employees").fetchone()[0]
if emp_count == 0:
    employees = [
        ("EMP-1001", "Rameez Khan", "Security Operations", "Chief Surveillance Officer"),
        ("EMP-1002", "Sarah Connor", "AI Engineering", "Computer Vision Specialist"),
        ("EMP-1003", "David Miller", "Infrastructure", "Facility Systems Lead"),
        ("EMP-1004", "Priya Sharma", "Risk & Compliance", "Security Analyst"),
        ("EMP-1005", "Alex Chen", "Site Operations", "Control Center Operator"),
    ]
    
    emp_ids = []
    for code, name, dept, desig in employees:
        eid = uuid.uuid4().hex
        emp_ids.append((eid, code, name))
        # Dummy 128-d face embedding array as JSON string
        dummy_enc = json.dumps([0.05 * (i % 7 - 3) for i in range(128)])
        conn.execute(
            """INSERT INTO employees (id, name, employee_id, department, designation, face_encoding, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (eid, name, code, dept, desig, dummy_enc, now.isoformat())
        )
    print(f"Seeded {len(employees)} employees.")
else:
    rows = conn.execute("SELECT id, employee_id, name FROM employees").fetchall()
    emp_ids = [(r[0], r[1], r[2]) for r in rows]

# 2. Seed Recognition History events for Today
rec_count = conn.execute("SELECT COUNT(*) FROM recognition_history").fetchone()[0]
if rec_count == 0 and emp_ids:
    import random
    sample_events = [
        (emp_ids[0][0], emp_ids[0][1], emp_ids[0][2], 94.8, "Live Camera Scanner", "Recognized", 9),
        (emp_ids[1][0], emp_ids[1][1], emp_ids[1][2], 92.1, "Corporate Lobby & Reception", "Recognized", 9),
        (None, None, "Unknown Subject", 41.5, "Main Entrance & Gate Scanner", "Unknown", 10),
        (emp_ids[2][0], emp_ids[2][1], emp_ids[2][2], 89.4, "Live Camera Scanner", "Recognized", 11),
        (emp_ids[3][0], emp_ids[3][1], emp_ids[3][2], 96.2, "Corporate Lobby & Reception", "Recognized", 11),
        (None, None, "Unknown Subject", 38.0, "Perimeter Security & Parking Bay", "Unknown", 12),
        (emp_ids[0][0], emp_ids[0][1], emp_ids[0][2], 95.3, "Corporate Lobby & Reception", "Recognized", 13),
        (emp_ids[4][0], emp_ids[4][1], emp_ids[4][2], 91.7, "Live Camera Scanner", "Recognized", 13),
    ]

    for euuid, code, name, conf, cam, status, hour in sample_events:
        rid = uuid.uuid4().hex
        ts = now.replace(hour=hour, minute=random.randint(5, 55), second=random.randint(10, 50)).isoformat()
        conn.execute(
            """INSERT INTO recognition_history 
               (id, employee_uuid, employee_id, employee_name, confidence, camera_name, status, timestamp)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (rid, euuid, code, name, conf, cam, status, ts)
        )

    # Also seed Attendance for today
    att_table = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='attendance_records'").fetchone()
    if att_table:
        for eid, code, name in emp_ids[:4]:
            aid = uuid.uuid4().hex
            t1 = now.replace(hour=8, minute=30, second=0).isoformat()
            t2 = now.replace(hour=13, minute=15, second=0).isoformat()
            conn.execute(
                """INSERT OR IGNORE INTO attendance_records 
                   (id, employee_uuid, date, first_seen, last_seen, camera_name, confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (aid, eid, today_str, t1, t2, "Live Camera Scanner", 95.0)
            )
    print("Seeded sample recognition history & attendance.")

conn.commit()
conn.close()
print("Biometrics seeding complete!")
