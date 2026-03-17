import pytest

from app.services.data_integration_service import _safe_table_name


def test_safe_table_name_accepts_normal_identifier():
    assert _safe_table_name("orders_2026") == "orders_2026"


@pytest.mark.parametrize("name", ["", "orders;DROP TABLE x", "a b", "1abc", "a-b"])
def test_safe_table_name_rejects_unsafe_identifier(name: str):
    with pytest.raises(ValueError):
        _safe_table_name(name)
