import os
import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["APP_ENV"] = "testing"
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-testing-only")

import app.db.init_models  # noqa: F401
from app.db.base import Base
from app.modules.categories import service as category_service
from app.modules.categories.model import Category
from app.modules.categories.schemas import CategoryCreateRequest
from app.modules.items import service as item_service
from app.modules.items.schemas import ItemCreateRequest
from app.modules.menus.model import Menu
from app.modules.restaurants.model import Restaurant


class MenuHierarchyServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        self.SessionLocal = sessionmaker(bind=self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def _seed(self):
        db = self.SessionLocal()
        restaurant_one = Restaurant(
            name="Tenant One",
            email="one@example.com",
            currency="LKR",
            is_active=True,
        )
        restaurant_two = Restaurant(
            name="Tenant Two",
            email="two@example.com",
            currency="USD",
            is_active=True,
        )
        db.add_all([restaurant_one, restaurant_two])
        db.flush()

        menu_one = Menu(name="Main Menu", restaurant_id=restaurant_one.id)
        menu_two = Menu(name="Other Menu", restaurant_id=restaurant_two.id)
        db.add_all([menu_one, menu_two])
        db.flush()

        category_one = Category(
            name="Rice",
            menu_id=menu_one.id,
            restaurant_id=restaurant_one.id,
        )
        category_two = Category(
            name="Dessert",
            menu_id=menu_two.id,
            restaurant_id=restaurant_two.id,
        )
        db.add_all([category_one, category_two])
        db.commit()

        return db, restaurant_one, restaurant_two, menu_one, menu_two, category_one, category_two

    def test_category_must_use_menu_from_same_restaurant(self) -> None:
        db, restaurant_one, _, _, menu_two, _, _ = self._seed()
        try:
            with self.assertRaises(HTTPException) as ctx:
                category_service.add_category(
                    db,
                    restaurant_one.id,
                    CategoryCreateRequest(name="Breakfast", menu_id=menu_two.id),
                )
            self.assertEqual(ctx.exception.status_code, 400)
        finally:
            db.close()

    def test_item_must_use_category_from_same_restaurant(self) -> None:
        db, restaurant_one, _, _, _, _, category_two = self._seed()
        try:
            with self.assertRaises(HTTPException) as ctx:
                item_service.add_item(
                    db,
                    restaurant_one.id,
                    ItemCreateRequest(
                        name="Chicken Rice",
                        price=1200,
                        category_id=category_two.id,
                    ),
                )
            self.assertEqual(ctx.exception.status_code, 400)
        finally:
            db.close()

    def test_item_is_created_under_valid_category(self) -> None:
        db, restaurant_one, _, _, _, category_one, _ = self._seed()
        try:
            item = item_service.add_item(
                db,
                restaurant_one.id,
                ItemCreateRequest(
                    name="Chicken Rice",
                    price=1200,
                    category_id=category_one.id,
                ),
            )
            self.assertEqual(item.category_id, category_one.id)
            self.assertEqual(item.restaurant_id, restaurant_one.id)
            self.assertEqual(item.currency, "LKR")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
