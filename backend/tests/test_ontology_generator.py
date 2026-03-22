from app.services.ontology_generator import (
    _build_fallback_object_types,
    _ensure_plan_has_object_types,
)


def test_build_fallback_object_types_from_command_description():
    object_types = _build_fallback_object_types("删除人员，部门，项目")

    assert [item["name"] for item in object_types] == ["person", "department", "project"]
    assert [item["display_name"] for item in object_types] == ["人员", "部门", "项目"]
    assert all(len(item["properties"]) >= 3 for item in object_types)


def test_ensure_plan_has_object_types_backfills_actions_and_warning():
    plan = {"object_types": [], "link_types": [], "action_types": []}

    filled = _ensure_plan_has_object_types(plan, "删除人员，部门，项目")

    assert len(filled["object_types"]) == 3
    assert len(filled["action_types"]) == 3
    assert all(action["logic_type"] == "delete_object" for action in filled["action_types"])
    assert "自动补全基础对象类型草稿" in filled["_warnings"][0]
