import os
import re

versions_dir = "backend/alembic/versions"

for filename in os.listdir(versions_dir):
    if not filename.endswith(".py"):
        continue
    filepath = os.path.join(versions_dir, filename)
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    
    # We want to catch op.add_column(...) and wrap it in a try-except
    # But wait, try-except around op.add_column doesn't work if the exception happens later during connection.execute() in online mode?
    # Ah! op.add_column() IMMEDIATELY executes the DDL in online mode!
    # Yes, because Alembic invokes the operation immediately unless it's offline mode.
    # Wait! In online mode, op.add_column() calls connection.execute().
    # So wrapping op.add_column() in try-except will catch the OperationalError!
