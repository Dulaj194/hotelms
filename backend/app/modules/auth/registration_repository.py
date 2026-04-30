from sqlalchemy.orm import Session

from app.modules.restaurants.model import RegistrationStatus, Restaurant
from app.modules.users.model import User, UserRole


def get_restaurant_by_email(db: Session, email: str) -> Restaurant | None:
    return db.query(Restaurant).filter(Restaurant.email == email).first()


def create_restaurant(
    db: Session,
    *,
    name: str,
    email: str,
    contact_number: str,
    address: str,
    opening_time: str,
    closing_time: str,
    logo_url: str,
) -> Restaurant:
    restaurant = Restaurant(
        name=name,
        email=email,
        phone=contact_number,
        address=address,
        opening_time=opening_time,
        closing_time=closing_time,
        logo_url=logo_url,
        is_active=False,
        registration_status=RegistrationStatus.PENDING,
    )
    db.add(restaurant)
    db.flush()
    return restaurant


def create_linked_admin(
    db: Session,
    *,
    full_name: str,
    email: str,
    password_hash: str,
    restaurant_id: int,
) -> User:
    admin_user = User(
        full_name=full_name,
        email=email,
        password_hash=password_hash,
        role=UserRole.owner,
        restaurant_id=restaurant_id,
        is_active=False,
        must_change_password=False,
    )
    db.add(admin_user)
    db.flush()
    return admin_user
