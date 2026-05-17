from fastapi import Request
from typing import Any, TypeVar, cast

T = TypeVar("T")

def get_language(request: Request) -> str:
    """Extract language from Accept-Language header. Default to 'en'."""
    accept_lang = request.headers.get("Accept-Language", "en")
    # Simplify: just check for 'si'
    if "si" in accept_lang.lower():
        return "si"
    return "en"

def localize_object(obj: Any, lang: str) -> Any:
    """
    Senior Software Engineer Approach:
    Recursively localizes any object (SQLAlchemy model, Pydantic model, dict, or list).
    Dynamically identifies all attributes/keys ending with '_si' and overwrites the base field
    with the Sinhala value if lang is 'si' and the Sinhala value is not empty.
    """
    if isinstance(obj, list):
        return [localize_object(item, lang) for item in obj]
    
    if isinstance(obj, dict):
        # 1. Localize keys ending with _si
        for k in list(obj.keys()):
            if k.endswith("_si"):
                base_k = k[:-3]
                val_si = obj[k]
                if lang == "si" and val_si is not None and val_si != "":
                    obj[base_k] = val_si
        
        # 2. Recurse into nested values
        for k, v in obj.items():
            if isinstance(v, (list, dict)) or hasattr(v, "__dict__"):
                obj[k] = localize_object(v, lang)
        return obj
    
    if hasattr(obj, "__dict__"):
        # 1. Localize attributes ending with _si
        attrs = list(obj.__dict__.keys())
        for attr in attrs:
            if attr.endswith("_si"):
                base_attr = attr[:-3]
                val_si = getattr(obj, attr, None)
                if lang == "si" and val_si is not None and val_si != "":
                    try:
                        setattr(obj, base_attr, val_si)
                    except Exception:
                        pass
        
        # 2. Recurse into nested attributes
        for attr in attrs:
            if attr.startswith("_"):
                continue
            try:
                v = getattr(obj, attr)
                if isinstance(v, (list, dict)) or hasattr(v, "__dict__"):
                    setattr(obj, attr, localize_object(v, lang))
            except Exception:
                pass
        return obj

    return obj
