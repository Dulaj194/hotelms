import redis as redis_lib
import uuid
from collections.abc import Callable

from fastapi import APIRouter, Cookie, Depends, File, Form, Header, HTTPException, Request, Response, UploadFile, status
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
    TenantContextResponse,
    TokenResponse,
    UserMeResponse,
)
from app.modules.users.model import User

router = APIRouter()


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _user_agent(request: Request) -> str:
    return request.headers.get("user-agent", "unknown")


def _handle_login_request(
    *,
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session,
    redis_client: redis_lib.Redis,
    refresh_token: str | None,
    login_fn: Callable[..., TokenResponse],
) -> TokenResponse:
    return login_fn(
        db,
        redis_client,
        response,
        payload.email,
        payload.password,
        _client_ip(request),
        _user_agent(request),
        refresh_token,
    )


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    return _handle_login_request(
        payload=payload,
        request=request,
        response=response,
        db=db,
        redis_client=redis_client,
        refresh_token=refresh_token,
        login_fn=service.login,
    )


@router.post("/login/restaurant-admin", response_model=TokenResponse)
def login_restaurant_admin(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    return _handle_login_request(
        payload=payload,
        request=request,
        response=response,
        db=db,
        redis_client=redis_client,
        refresh_token=refresh_token,
        login_fn=service.login_restaurant_admin,
    )


@router.post("/login/staff", response_model=TokenResponse)
def login_staff(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    return _handle_login_request(
        payload=payload,
        request=request,
        response=response,
        db=db,
        redis_client=redis_client,
        refresh_token=refresh_token,
        login_fn=service.login_staff,
    )


@router.post("/login/super-admin", response_model=TokenResponse)
def login_super_admin(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
    refresh_token: str | None = Cookie(default=None),
) -> TokenResponse:
    return _handle_login_request(
        payload=payload,
        request=request,
        response=response,
        db=db,
        redis_client=redis_client,
        refresh_token=refresh_token,
        login_fn=service.login_super_admin,
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
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserMeResponse:
    return service.get_user_me_snapshot(db, current_user)


@router.get("/tenant-context", response_model=TenantContextResponse)
def get_tenant_context(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantContextResponse:
    return service.get_tenant_context_snapshot(db, current_user)


@router.post("/register-restaurant", response_model=RegisterRestaurantResponse)
async def register_restaurant(
    request: Request,
    restaurant_name: str = Form(..., min_length=1, max_length=255),
    owner_full_name: str = Form(..., min_length=1, max_length=255),
    owner_email: str = Form(...),
    address: str = Form(..., min_length=1, max_length=500),
    contact_number: str = Form(..., pattern=r"^[0-9]{10}$"),
    password: str = Form(..., min_length=8),
    confirm_password: str = Form(..., min_length=8),
    opening_time: str = Form(..., pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$"),
    closing_time: str = Form(..., pattern=r"^([01][0-9]|2[0-3]):[0-5][0-9]$"),
    logo: UploadFile = File(...),
    idempotency_key: str = Header(..., alias="X-Idempotency-Key"),
    correlation_id: str | None = Header(default=None, alias="X-Correlation-ID"),
    db: Session = Depends(get_db),
    redis_client: redis_lib.Redis = Depends(get_redis),
) -> RegisterRestaurantResponse:
    final_correlation_id = correlation_id or str(uuid.uuid4())

    payload = RegisterRestaurantRequest(
        restaurant_name=restaurant_name,
        owner_full_name=owner_full_name,
        owner_email=owner_email,
        address=address,
        contact_number=contact_number,
        password=password,
        confirm_password=confirm_password,
        opening_time=opening_time,
        closing_time=closing_time,
    )

    restaurant_id, saved_owner_email = await service.register_restaurant_idempotent(
        db,
        redis_client,
        restaurant_name=payload.restaurant_name,
        owner_full_name=payload.owner_full_name,
        owner_email=str(payload.owner_email),
        address=payload.address,
        contact_number=payload.contact_number,
        password=payload.password,
        confirm_password=payload.confirm_password,
        opening_time=payload.opening_time,
        closing_time=payload.closing_time,
        logo=logo,
        idempotency_key=idempotency_key,
        correlation_id=final_correlation_id,
        ip=_client_ip(request),
        user_agent=_user_agent(request),
    )
    return RegisterRestaurantResponse(
        message="Registration submitted successfully. Your account will activate after super admin approval.",
        message_key="registration_pending_approval",
        restaurant_id=restaurant_id,
        owner_email=saved_owner_email,
        correlation_id=final_correlation_id,
    )
