from types import SimpleNamespace

from app.services.aip_service import ONTOLOGY_TOOLS, WRITE_TOOLS, _filter_tools_for_user


def _tool_names(tools: list[dict]) -> set[str]:
    return {t["function"]["name"] for t in tools}


def test_viewer_cannot_use_write_tools():
    viewer = SimpleNamespace(role="viewer")
    filtered = _filter_tools_for_user(ONTOLOGY_TOOLS, viewer)
    names = _tool_names(filtered)
    assert WRITE_TOOLS.isdisjoint(names)


def test_editor_can_use_write_tools():
    editor = SimpleNamespace(role="editor")
    filtered = _filter_tools_for_user(ONTOLOGY_TOOLS, editor)
    names = _tool_names(filtered)
    assert WRITE_TOOLS.issubset(names)
