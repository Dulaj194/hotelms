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

def localize_object(obj: Any, lang: str, seen: set[int] | None = None) -> Any:
    """
    Senior Software Engineer Approach:
    Recursively localizes any object (SQLAlchemy model, Pydantic model, dict, or list).
    Dynamically identifies all attributes/keys ending with '_si' and overwrites the base field
    with the Sinhala value if lang is 'si' and the Sinhala value is not empty.
    
    Includes recursion protection to prevent infinite loops on circular dependencies.
    """
    if obj is None:
        return obj

    if seen is None:
        seen = set()

    obj_id = id(obj)
    if obj_id in seen:
        return obj

    if isinstance(obj, list):
        return [localize_object(item, lang, seen) for item in obj]
    
    # Track complex types to prevent recursion
    is_complex = isinstance(obj, (dict, list)) or hasattr(obj, "__dict__")
    try:
        from pydantic import BaseModel
        if isinstance(obj, BaseModel):
            is_complex = True
    except Exception:
        pass

    if is_complex:
        seen.add(obj_id)
    
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
                obj[k] = localize_object(v, lang, seen)
        return obj
    
    # Handle Pydantic models (BaseModel)
    try:
        from pydantic import BaseModel
        is_pydantic = isinstance(obj, BaseModel)
    except Exception:
        is_pydantic = False

    if is_pydantic:
        # Pydantic v2 has model_fields, Pydantic v1 has __fields__
        fields = list(obj.__class__.model_fields.keys()) if hasattr(obj.__class__, "model_fields") else list(obj.__fields__.keys())
        
        # 1. Localize attributes ending with _si
        for field in fields:
            if field.endswith("_si"):
                base_field = field[:-3]
                val_si = getattr(obj, field, None)
                if lang == "si" and val_si is not None and val_si != "":
                    try:
                        # Direct dictionary update bypasses read-only/frozen constraints
                        obj.__dict__[base_field] = val_si
                    except Exception:
                        try:
                            setattr(obj, base_field, val_si)
                        except Exception:
                            pass
        
        # 2. Recurse into nested attributes of the Pydantic model
        for field in fields:
            if field.startswith("_"):
                continue
            try:
                v = getattr(obj, field)
                if isinstance(v, (list, dict, BaseModel)) or hasattr(v, "__dict__"):
                    localized_v = localize_object(v, lang, seen)
                    try:
                        obj.__dict__[field] = localized_v
                    except Exception:
                        try:
                            setattr(obj, field, localized_v)
                        except Exception:
                            pass
            except Exception:
                pass
        return obj
    
    # Handle SQLAlchemy models and other non-dict objects
    if hasattr(obj, "__dict__"):
        attrs = []
        try:
            from sqlalchemy import inspect
            inspected = inspect(obj)
            if inspected is not None:
                attrs = list(inspected.mapper.attrs.keys())
        except Exception:
            attrs = list(obj.__dict__.keys())
        
        if not attrs:
            attrs = list(obj.__dict__.keys())

        # Include properties/relationships on custom class that are not in mapper or __dict__ but are in dir(obj)
        for attr in dir(obj):
            if not attr.startswith("_") and attr not in attrs:
                if attr.endswith("_si") or isinstance(getattr(obj.__class__, attr, None), property):
                    attrs.append(attr)

        # 1. Localize attributes ending with _si
        for attr in attrs:
            if attr.endswith("_si"):
                base_attr = attr[:-3]
                val_si = getattr(obj, attr, None)
                if lang == "si" and val_si is not None and val_si != "":
                    try:
                        setattr(obj, base_attr, val_si)
                    except Exception:
                        try:
                            obj.__dict__[base_attr] = val_si
                        except Exception:
                            pass
        
        # 2. Recurse into nested attributes
        for attr in attrs:
            if attr.startswith("_"):
                continue
            try:
                v = getattr(obj, attr)
                if isinstance(v, (list, dict, BaseModel)) or hasattr(v, "__dict__"):
                    try:
                        setattr(obj, attr, localize_object(v, lang, seen))
                    except Exception:
                        try:
                            obj.__dict__[attr] = localize_object(v, lang, seen)
                        except Exception:
                            pass
            except Exception:
                pass
        return obj

    return obj

