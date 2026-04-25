import sys
import os

# Add the parent directory to the path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.modules.users.model import User, UserRole
from app.core.security import hash_password
from app.modules.platform_access.catalog import DEFAULT_PLATFORM_SCOPES

def create_super_admin(email: str, password: str, full_name: str):
    with SessionLocal() as db:
        user = db.query(User).filter(User.email == email).first()
        if user:
            print(f"Error: User with email '{email}' already exists.")
            return

        new_user = User(
            email=email,
            password_hash=hash_password(password),
            full_name=full_name,
            role=UserRole.super_admin,
            is_active=True,
            restaurant_id=None,  # Platform level user, no specific restaurant
        )
        
        # Give all platform scopes
        new_user.set_super_admin_scopes(DEFAULT_PLATFORM_SCOPES)
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        print(f"Success! Super admin created successfully:")
        print(f"Email: {new_user.email}")
        print(f"Name: {new_user.full_name}")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python scripts/create_super_admin.py <email> <password> <full_name>")
        sys.exit(1)
    
    email = sys.argv[1]
    password = sys.argv[2]
    full_name = sys.argv[3]
    
    create_super_admin(email, password, full_name)
