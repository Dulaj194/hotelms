from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.logging import get_logger
from app.modules.reference_data import repository
from app.modules.reference_data.schemas import (
    CountryListResponse,
    CountryResponse,
    CurrencyTypeListResponse,
    CurrencyTypeResponse,
)

logger = get_logger(__name__)

LEGACY_COUNTRY_NAMES: tuple[str, ...] = (
    "Afghanistan",
    "Albania",
    "Algeria",
    "Andorra",
    "Angola",
    "Antigua and Barbuda",
    "Argentina",
    "Armenia",
    "Australia",
    "Austria",
    "Azerbaijan",
    "Bahamas",
    "Bahrain",
    "Bangladesh",
    "Barbados",
    "Belarus",
    "Belgium",
    "Belize",
    "Benin",
    "Bhutan",
    "Bolivia",
    "Bosnia and Herzegovina",
    "Botswana",
    "Brazil",
    "Brunei",
    "Bulgaria",
    "Burkina Faso",
    "Burundi",
    "Cabo Verde",
    "Cambodia",
    "Cameroon",
    "Canada",
    "Central African Republic",
    "Chad",
    "Chile",
    "China",
    "Colombia",
    "Comoros",
    "Congo, Democratic Republic of the",
    "Congo, Republic of the",
    "Costa Rica",
    "Croatia",
    "Cuba",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Djibouti",
    "Dominica",
    "Dominican Republic",
    "East Timor",
    "Ecuador",
    "Egypt",
    "El Salvador",
    "Equatorial Guinea",
    "Eritrea",
    "Estonia",
    "Eswatini",
    "Ethiopia",
    "Fiji",
    "Finland",
    "France",
    "Gabon",
    "Gambia",
    "Georgia",
    "Germany",
    "Ghana",
    "Greece",
    "Grenada",
    "Guatemala",
    "Guinea",
    "Guinea-Bissau",
    "Guyana",
    "Haiti",
    "Honduras",
    "Hungary",
    "Iceland",
    "India",
    "Indonesia",
    "Iran",
    "Iraq",
    "Ireland",
    "Israel",
    "Italy",
    "Jamaica",
    "Japan",
    "Jordan",
    "Kazakhstan",
    "Kenya",
    "Kiribati",
    "Korea, North",
    "Korea, South",
    "Kuwait",
    "Kyrgyzstan",
    "Laos",
    "Latvia",
    "Lebanon",
    "Lesotho",
    "Liberia",
    "Libya",
    "Liechtenstein",
    "Lithuania",
    "Luxembourg",
    "Madagascar",
    "Malawi",
    "Malaysia",
    "Maldives",
    "Mali",
    "Malta",
    "Marshall Islands",
    "Mauritania",
    "Mauritius",
    "Mexico",
    "Micronesia",
    "Moldova",
    "Monaco",
    "Mongolia",
    "Montenegro",
    "Morocco",
    "Mozambique",
    "Myanmar",
    "Namibia",
    "Nauru",
    "Nepal",
    "Netherlands",
    "New Zealand",
    "Nicaragua",
    "Niger",
    "Nigeria",
    "North Macedonia",
    "Norway",
    "Oman",
    "Pakistan",
    "Palau",
    "Panama",
    "Papua New Guinea",
    "Paraguay",
    "Peru",
    "Philippines",
    "Poland",
    "Portugal",
    "Qatar",
    "Romania",
    "Russia",
    "Rwanda",
    "Saint Kitts and Nevis",
    "Saint Lucia",
    "Saint Vincent and the Grenadines",
    "Samoa",
    "San Marino",
    "Sao Tome and Principe",
    "Saudi Arabia",
    "Senegal",
    "Serbia",
    "Seychelles",
    "Sierra Leone",
    "Singapore",
    "Slovakia",
    "Slovenia",
    "Solomon Islands",
    "Somalia",
    "South Africa",
    "South Sudan",
    "Spain",
    "Sri Lanka",
    "Sudan",
    "Suriname",
    "Sweden",
    "Switzerland",
    "Syria",
    "Taiwan",
    "Tajikistan",
    "Tanzania",
    "Thailand",
    "Togo",
    "Tonga",
    "Trinidad and Tobago",
    "Tunisia",
    "Turkey",
    "Turkmenistan",
    "Tuvalu",
    "Uganda",
    "Ukraine",
    "United Arab Emirates",
    "United Kingdom",
    "United States",
    "Uruguay",
    "Uzbekistan",
    "Vanuatu",
    "Vatican City",
    "Venezuela",
    "Vietnam",
    "Yemen",
    "Zambia",
    "Zimbabwe",
)

LEGACY_CURRENCIES: tuple[tuple[str, str, str | None], ...] = (
    ("USD", "United States Dollar", "$"),
    ("EUR", "Euro", "EUR"),
    ("GBP", "British Pound Sterling", "GBP"),
    ("JPY", "Japanese Yen", "JPY"),
    ("AUD", "Australian Dollar", "AUD"),
    ("CAD", "Canadian Dollar", "CAD"),
    ("CHF", "Swiss Franc", "CHF"),
    ("CNY", "Chinese Yuan", "CNY"),
    ("SEK", "Swedish Krona", "SEK"),
    ("NZD", "New Zealand Dollar", "NZD"),
    ("INR", "Indian Rupee", "INR"),
    ("BRL", "Brazilian Real", "BRL"),
    ("RUB", "Russian Ruble", "RUB"),
    ("ZAR", "South African Rand", "ZAR"),
    ("MXN", "Mexican Peso", "MXN"),
    ("SGD", "Singapore Dollar", "SGD"),
    ("HKD", "Hong Kong Dollar", "HKD"),
    ("NOK", "Norwegian Krone", "NOK"),
    ("KRW", "South Korean Won", "KRW"),
    ("TRY", "Turkish Lira", "TRY"),
    ("SAR", "Saudi Riyal", "SAR"),
    ("AED", "United Arab Emirates Dirham", "AED"),
    ("LKR", "Sri Lankan Rupee", "LKR"),
    ("THB", "Thai Baht", "THB"),
    ("MYR", "Malaysian Ringgit", "MYR"),
    ("IDR", "Indonesian Rupiah", "IDR"),
    ("VND", "Vietnamese Dong", "VND"),
    ("PLN", "Polish Zloty", "PLN"),
    ("PHP", "Philippine Peso", "PHP"),
    ("EGP", "Egyptian Pound", "EGP"),
    ("ILS", "Israeli New Shekel", "ILS"),
    ("KWD", "Kuwaiti Dinar", "KWD"),
    ("QAR", "Qatari Riyal", "QAR"),
    ("PKR", "Pakistani Rupee", "PKR"),
    ("TWD", "New Taiwan Dollar", "TWD"),
    ("DKK", "Danish Krone", "DKK"),
    ("HUF", "Hungarian Forint", "HUF"),
    ("CZK", "Czech Koruna", "CZK"),
    ("ARS", "Argentine Peso", "ARS"),
    ("CLP", "Chilean Peso", "CLP"),
    ("NGN", "Nigerian Naira", "NGN"),
    ("KES", "Kenyan Shilling", "KES"),
    ("GHS", "Ghanaian Cedi", "GHS"),
    ("MAD", "Moroccan Dirham", "MAD"),
)


def ensure_reference_seed_data(db: Session) -> None:
    seeded = False

    if repository.count_countries(db) == 0:
        for country_name in LEGACY_COUNTRY_NAMES:
            repository.create_country(db, name=country_name, iso2=None)
        seeded = True
        logger.info("Seeded %d countries from legacy baseline.", len(LEGACY_COUNTRY_NAMES))

    if repository.count_currencies(db) == 0:
        for code, name, symbol in LEGACY_CURRENCIES:
            repository.create_currency(db, code=code, name=name, symbol=symbol)
        seeded = True
        logger.info("Seeded %d currencies from legacy baseline.", len(LEGACY_CURRENCIES))

    if seeded:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()


def list_countries(db: Session) -> CountryListResponse:
    ensure_reference_seed_data(db)
    rows = repository.list_active_countries(db)
    items = [CountryResponse.model_validate(row) for row in rows]
    return CountryListResponse(items=items, total=len(items))


def list_currencies(db: Session) -> CurrencyTypeListResponse:
    ensure_reference_seed_data(db)
    rows = repository.list_active_currencies(db)
    items = [CurrencyTypeResponse.model_validate(row) for row in rows]
    return CurrencyTypeListResponse(items=items, total=len(items))


def resolve_country_from_id_or_name(
    db: Session,
    *,
    country_id: int | None,
    country_name: str | None,
) -> tuple[int | None, str | None]:
    ensure_reference_seed_data(db)

    if country_id is not None:
        country_row = repository.get_country_by_id(db, country_id)
        if not country_row:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid country_id. Use /reference-data/countries to fetch valid values.",
            )
        return country_row.id, country_row.name

    if country_name is None:
        return None, None

    normalized = country_name.strip()
    if not normalized:
        return None, None

    country_row = repository.get_country_by_name(db, normalized)
    if not country_row:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid country value. Use /reference-data/countries to fetch valid values.",
        )
    return country_row.id, country_row.name


def resolve_currency_from_id_or_value(
    db: Session,
    *,
    currency_id: int | None,
    currency_value: str | None,
) -> tuple[int | None, str | None]:
    ensure_reference_seed_data(db)

    if currency_id is not None:
        currency_row = repository.get_currency_by_id(db, currency_id)
        if not currency_row:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Invalid currency_id. Use /reference-data/currencies to fetch valid values.",
            )
        return currency_row.id, currency_row.code

    if currency_value is None:
        return None, None

    normalized = currency_value.strip()
    if not normalized:
        return None, None

    currency_row = repository.get_currency_by_code_or_name(db, normalized)
    if not currency_row:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid currency value. Use /reference-data/currencies to fetch valid values.",
        )
    return currency_row.id, currency_row.code
