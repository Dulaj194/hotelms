import redis as redis_lib
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_db, get_redis
from app.modules.auth import service
from app.modules.auth.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    GenericMessageResponse,
    InitialPasswordChangeRequest,
    LoginRequest,
    RegisterRestaurantRequest,
    RegisterRestaurantResponse,
    ResetPasswordRequest,
    TokenResponse,
    UserMeResponse,
)
from app.modules.users.model import User

router = APIRouter()


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
) -> TokenResponse:
    return service.login(
        db, redis_client, response,
        payload.email, payload.password,
        _client_ip(request), _user_agent(request),
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided.",
        )
    return service.refresh(
        db, redis_client, response, refresh_token,
        _client_ip(request), _user_agent(request),
    )


@router.post("/logout", response_model=GenericMessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
    refresh_token: str | None = Cookie(default=None),
) -> dict:
    return service.logout(
        db, redis_client, response, refresh_token,
        current_user.id, _client_ip(request), _user_agent(request),
    )


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    response_model_exclude_none=True,
)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> ForgotPasswordResponse:
    return service.forgot_password(
        db, payload.email, _client_ip(request), _user_agent(request),
    )


@router.post("/reset-password", response_model=GenericMessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    return service.reset_password(
        db, payload.token, payload.new_password,
        _client_ip(request), _user_agent(request),
    )


@router.post("/change-initial-password", response_model=GenericMessageResponse)
def change_initial_password(
    payload: InitialPasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return service.change_initial_password(db, current_user, payload)


@router.get("/me", response_model=UserMeResponse)
def get_me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/register-restaurant", response_model=RegisterRestaurantResponse)
def register_restaurant(
    payload: RegisterRestaurantRequest,
    db: Session = Depends(get_db),
) -> RegisterRestaurantResponse:
    restaurant_id, owner_email = service.register_restaurant(
        db,
        restaurant_name=payload.restaurant_name,
        owner_full_name=payload.owner_full_name,
        owner_email=str(payload.owner_email),
        password=payload.password,
        confirm_password=payload.confirm_password,
        phone=payload.phone,
        address=payload.address,
        country=payload.country,
        currency=payload.currency,
    )
    return RegisterRestaurantResponse(
        message="Restaurant registered successfully. You can now sign in.",
        restaurant_id=restaurant_id,
        owner_email=owner_email,
    )
