from app.services.security import (
    decrypt_secret,
    decrypt_sensitive_config,
    encrypt_secret,
    encrypt_sensitive_config,
)


def test_encrypt_secret_round_trip():
    raw = "secret-value"
    encrypted = encrypt_secret(raw)
    assert encrypted.startswith("enc:v1:")
    assert decrypt_secret(encrypted) == raw


def test_encrypt_sensitive_config_only_for_sensitive_keys():
    cfg = {
        "user": "alice",
        "password": "pw",
        "nested": {"api_key": "k1", "region": "cn"},
    }
    encrypted = encrypt_sensitive_config(cfg)
    assert encrypted["user"] == "alice"
    assert encrypted["password"].startswith("enc:v1:")
    assert encrypted["nested"]["api_key"].startswith("enc:v1:")
    assert encrypted["nested"]["region"] == "cn"
    assert decrypt_sensitive_config(encrypted) == cfg
