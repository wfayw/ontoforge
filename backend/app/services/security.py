import base64
import hashlib
import ipaddress
import socket
from urllib.parse import urlparse

from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

_ENC_PREFIX = "enc:v1:"
_SENSITIVE_CONFIG_KEYS = {
    "password",
    "passwd",
    "secret",
    "token",
    "api_key",
    "apikey",
    "access_key",
    "private_key",
}


def _build_fernet() -> Fernet:
    settings = get_settings()
    raw = (settings.ENCRYPTION_KEY or "").encode("utf-8")
    digest = hashlib.sha256(raw).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    if value.startswith(_ENC_PREFIX):
        return value
    token = _build_fernet().encrypt(value.encode("utf-8")).decode("utf-8")
    return f"{_ENC_PREFIX}{token}"


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    if not value.startswith(_ENC_PREFIX):
        return value
    token = value[len(_ENC_PREFIX):]
    try:
        return _build_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return ""


def encrypt_sensitive_config(config: dict) -> dict:
    if not isinstance(config, dict):
        return config
    out: dict = {}
    for key, value in config.items():
        key_l = str(key).lower()
        if isinstance(value, dict):
            out[key] = encrypt_sensitive_config(value)
        elif isinstance(value, str) and key_l in _SENSITIVE_CONFIG_KEYS:
            out[key] = encrypt_secret(value)
        else:
            out[key] = value
    return out


def decrypt_sensitive_config(config: dict) -> dict:
    if not isinstance(config, dict):
        return config
    out: dict = {}
    for key, value in config.items():
        if isinstance(value, dict):
            out[key] = decrypt_sensitive_config(value)
        elif isinstance(value, str):
            out[key] = decrypt_secret(value)
        else:
            out[key] = value
    return out


def validate_rest_api_url(url: str, allow_private: bool = False) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("REST API URL must use http or https")
    if not parsed.hostname:
        raise ValueError("REST API URL is missing hostname")
    if allow_private:
        return

    try:
        addr_info = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror as exc:
        raise ValueError(f"Could not resolve host: {parsed.hostname}") from exc

    for _, _, _, _, sockaddr in addr_info:
        ip_str = sockaddr[0]
        ip = ipaddress.ip_address(ip_str)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved:
            raise ValueError(f"Private or reserved address is not allowed: {ip}")
