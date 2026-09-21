import hmac
import re
import uuid
from typing import Optional

from fastapi import Header, HTTPException

import config as C

_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


def safe_request_id(candidate: Optional[str]) -> str:
    value = candidate.strip() if isinstance(candidate, str) else ""
    return value if _SAFE_REQUEST_ID.fullmatch(value) else str(uuid.uuid4())


def is_authorized(authorization: Optional[str], expected: str) -> bool:
    if not authorization or not authorization.startswith("Bearer "):
        return False
    supplied = authorization[7:].strip()
    return bool(supplied) and hmac.compare_digest(supplied, expected)


def require_service_auth(authorization: Optional[str] = Header(default=None)):
    if not is_authorized(authorization, C.ML_SERVICE_TOKEN):
        raise HTTPException(status_code=401, detail="Unauthorized")
