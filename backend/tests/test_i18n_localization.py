import sys
import unittest
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.core.i18n import localize_object
from app.modules.public.schemas import (
    PublicMenuResponse,
    PublicRestaurantInfoResponse,
    PublicMenuSectionResponse,
    PublicCategoryResponse,
    PublicItemSummaryResponse,
)


class TestI18nLocalization(unittest.TestCase):
    def test_localize_dict(self) -> None:
        data = {
            "name": "Beverages",
            "name_si": "බීම වර්ග",
            "details": {
                "desc": "Cold drinks",
                "desc_si": "සිසිල් බීම",
            }
        }
        localized = localize_object(data, "si")
        self.assertEqual(localized["name"], "බීම වර්ග")
        self.assertEqual(localized["details"]["desc"], "සිසිල් බීම")

    def test_localize_list(self) -> None:
        data = [
            {"name": "Tea", "name_si": "තේ"},
            {"name": "Coffee", "name_si": "කෝපි"},
        ]
        localized = localize_object(data, "si")
        self.assertEqual(localized[0]["name"], "තේ")
        self.assertEqual(localized[1]["name"], "කෝපි")

    def test_localize_complex_pydantic_model(self) -> None:
        # Construct item, category, and section
        item = PublicItemSummaryResponse(
            id=1,
            name="Coca Cola",
            name_si="කෝකා කෝලා",
            description="Chilled beverage",
            description_si="සිසිල් කළ බීම",
            price=250.0,
            image_path="/images/cola.jpg",
            image_path_si="/images/cola_si.jpg",
            is_available=True,
            category_id=1,
        )

        category = PublicCategoryResponse(
            id=1,
            name="Drinks",
            name_si="බීම වර්ග",
            description="Soft drinks and juices",
            description_si="පැණි බීම සහ යුෂ",
            image_path="/images/drinks.jpg",
            image_path_si="/images/drinks_si.jpg",
            sort_order=1,
            menu_id=1,
            items=[item],
        )

        menu_section = PublicMenuSectionResponse(
            id=1,
            name="Beverages",
            name_si="බීම මෙනුව",
            description="All beverages",
            description_si="සියලුම බීම වර්ග",
            image_path="/images/bev.jpg",
            image_path_si="/images/bev_si.jpg",
            sort_order=1,
            categories=[category],
        )

        restaurant = PublicRestaurantInfoResponse(
            id=1,
            name="Grand Hotel",
            phone="0112345678",
            address="Colombo",
            logo_url="/logo.png",
            is_active=True,
        )

        menu_response = PublicMenuResponse(
            restaurant=restaurant,
            menus=[menu_section],
            uncategorized_categories=[],
            categories=[category],
            offers=[]
        )

        # Localize
        localized = localize_object(menu_response, "si")

        # Verify main and nested values
        self.assertEqual(localized.menus[0].name, "බීම මෙනුව")
        self.assertEqual(localized.menus[0].description, "සියලුම බීම වර්ග")
        self.assertEqual(localized.menus[0].image_path, "/images/bev_si.jpg")
        
        self.assertEqual(localized.categories[0].name, "බීම වර්ග")
        self.assertEqual(localized.categories[0].description, "පැණි බීම සහ යුෂ")
        self.assertEqual(localized.categories[0].image_path, "/images/drinks_si.jpg")

        self.assertEqual(localized.categories[0].items[0].name, "කෝකා කෝලා")
        self.assertEqual(localized.categories[0].items[0].description, "සිසිල් කළ බීම")
        self.assertEqual(localized.categories[0].items[0].image_path, "/images/cola_si.jpg")


if __name__ == "__main__":
    unittest.main()
