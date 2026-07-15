import sys
from app.db.session import engine
from sqlalchemy import text

try:
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE restaurants ADD COLUMN enable_tables BOOLEAN NOT NULL DEFAULT 1"))
        except Exception as e:
            print(f"Skipping enable_tables: {e}")
            
        try:
            conn.execute(text("ALTER TABLE restaurants ADD COLUMN enable_rooms BOOLEAN NOT NULL DEFAULT 1"))
        except Exception as e:
            print(f"Skipping enable_rooms: {e}")
            
        conn.commit()
    print("Missing columns fix script completed successfully")
except Exception as e:
    print(f"Error: {e}")
