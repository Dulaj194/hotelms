"""
Application Entry Point
Run with: uvicorn main:app --reload
"""

from app.main import app

if __name__ == "__main__":
    import uvicorn
    from app.core.settings import settings

    uvicorn.run(
        "app.main:app",
        host=settings.server_host,
        port=settings.server_port,
        reload=settings.is_development,
        workers=settings.workers if settings.is_production else 1,
    )
