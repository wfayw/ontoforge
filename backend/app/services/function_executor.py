"""Ontology Function executor — safe Python expression sandbox."""

import ast
import math
import operator
import logging
from datetime import datetime, date
from typing import Any

logger = logging.getLogger(__name__)

SAFE_BUILTINS = {
    "abs": abs, "round": round, "min": min, "max": max,
    "int": int, "float": float, "str": str, "bool": bool,
    "len": len, "sum": sum, "sorted": sorted,
    "True": True, "False": False, "None": None,
}

SAFE_MATH = {
    "ceil": math.ceil, "floor": math.floor, "sqrt": math.sqrt,
    "log": math.log, "log10": math.log10, "pow": math.pow,
    "pi": math.pi, "e": math.e,
}

SAFE_DATE = {
    "now": datetime.now, "today": date.today,
    "datetime": datetime, "date": date,
}

ALLOWED_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.And: lambda a, b: a and b,
    ast.Or: lambda a, b: a or b,
    ast.Not: operator.not_,
}

class FunctionError(Exception):
    pass


def _safe_eval(node: ast.AST, env: dict[str, Any], depth: int = 0) -> Any:
    """Recursively evaluate an AST node in a restricted environment."""
    if depth > 50:
        raise FunctionError("Expression too deeply nested")

    if isinstance(node, ast.Expression):
        return _safe_eval(node.body, env, depth + 1)

    if isinstance(node, ast.Constant):
        return node.value

    if isinstance(node, ast.Name):
        if node.id in env:
            return env[node.id]
        raise FunctionError(f"Undefined variable: {node.id}")

    if isinstance(node, ast.BinOp):
        left = _safe_eval(node.left, env, depth + 1)
        right = _safe_eval(node.right, env, depth + 1)
        op = ALLOWED_OPS.get(type(node.op))
        if not op:
            raise FunctionError(f"Unsupported operator: {type(node.op).__name__}")
        return op(left, right)

    if isinstance(node, ast.UnaryOp):
        operand = _safe_eval(node.operand, env, depth + 1)
        op = ALLOWED_OPS.get(type(node.op))
        if not op:
            raise FunctionError(f"Unsupported unary operator: {type(node.op).__name__}")
        return op(operand)

    if isinstance(node, ast.BoolOp):
        values = [_safe_eval(v, env, depth + 1) for v in node.values]
        if isinstance(node.op, ast.And):
            return all(values)
        return any(values)

    if isinstance(node, ast.Compare):
        left = _safe_eval(node.left, env, depth + 1)
        for op, comparator in zip(node.ops, node.comparators):
            right = _safe_eval(comparator, env, depth + 1)
            op_func = ALLOWED_OPS.get(type(op))
            if not op_func:
                raise FunctionError(f"Unsupported comparison: {type(op).__name__}")
            if not op_func(left, right):
                return False
            left = right
        return True

    if isinstance(node, ast.IfExp):
        cond = _safe_eval(node.test, env, depth + 1)
        return _safe_eval(node.body if cond else node.orelse, env, depth + 1)

    if isinstance(node, ast.Call):
        func = _safe_eval(node.func, env, depth + 1)
        if not callable(func):
            raise FunctionError(f"Not callable: {func}")
        args = [_safe_eval(a, env, depth + 1) for a in node.args]
        kwargs = {kw.arg: _safe_eval(kw.value, env, depth + 1) for kw in node.keywords}
        return func(*args, **kwargs)

    if isinstance(node, ast.Attribute):
        value = _safe_eval(node.value, env, depth + 1)
        attr = node.attr
        if attr.startswith("_"):
            raise FunctionError(f"Access to private attribute forbidden: {attr}")
        return getattr(value, attr)

    if isinstance(node, ast.Subscript):
        value = _safe_eval(node.value, env, depth + 1)
        key = _safe_eval(node.slice, env, depth + 1)
        return value[key]

    if isinstance(node, ast.List):
        return [_safe_eval(e, env, depth + 1) for e in node.elts]

    if isinstance(node, ast.Dict):
        keys = [_safe_eval(k, env, depth + 1) for k in node.keys]
        vals = [_safe_eval(v, env, depth + 1) for v in node.values]
        return dict(zip(keys, vals))

    if isinstance(node, ast.Tuple):
        return tuple(_safe_eval(e, env, depth + 1) for e in node.elts)

    raise FunctionError(f"Unsupported expression: {type(node).__name__}")


def execute_function(code: str, inputs: dict[str, Any]) -> Any:
    """Execute a Python expression in a safe sandbox.

    The expression can reference input variables and a curated set of builtins/math/date functions.
    """
    env: dict[str, Any] = {}
    env.update(SAFE_BUILTINS)
    env.update(SAFE_MATH)
    env.update(SAFE_DATE)
    env.update(inputs)

    try:
        tree = ast.parse(code.strip(), mode="eval")
    except SyntaxError as e:
        raise FunctionError(f"Syntax error: {e}") from e

    return _safe_eval(tree, env)
