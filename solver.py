from dataclasses import dataclass

from scipy.optimize import linprog


class LinearProgramError(ValueError):
    pass


@dataclass
class ParsedProblem:
    optimization_type: str
    objective: list[float]
    variable_names: list[str]
    a_ub: list[list[float]]
    b_ub: list[float]
    a_eq: list[list[float]]
    b_eq: list[float]
    non_negative: list[bool]
    original_constraints: list[dict]


def solve_linear_program(data: dict) -> dict:
    # organiza os dados recebidos da tela
    problem = _parse_problem(data)

    # o scipy minimiza por padrao, entao a maximizacao troca o sinal
    c = problem.objective[:]
    if problem.optimization_type == "maximize":
        c = [-value for value in c]

    # executa o solver com as restricoes e a nao negatividade escolhida
    result = linprog(
        c=c,
        A_ub=problem.a_ub or None,
        b_ub=problem.b_ub or None,
        A_eq=problem.a_eq or None,
        b_eq=problem.b_eq or None,
        bounds=[(0, None) if applied else (None, None) for applied in problem.non_negative],
        method="highs",
    )

    if not result.success:
        return {
            "status": result.status,
            "message": _translate_solver_message(result.message),
            "optimal_value": None,
            "variables": [],
            "slacks": [],
        }

    optimal_value = float(result.fun)
    if problem.optimization_type == "maximize":
        optimal_value *= -1

    variable_values = [
        {
            "name": name,
            "value": _round_float(value),
        }
        for name, value in zip(problem.variable_names, result.x)
    ]

    slacks = _calculate_slacks(problem.original_constraints, result.x)
    non_negative_rules = [
        {"name": name, "applied": applied}
        for name, applied in zip(problem.variable_names, problem.non_negative)
    ]

    return {
        "status": result.status,
            "message": "Solução ótima encontrada.",
        "optimal_value": _round_float(optimal_value),
        "variables": variable_values,
        "non_negative": non_negative_rules,
        "slacks": slacks,
    }


def _parse_problem(data: dict) -> ParsedProblem:
    # transforma o json do formulario em matrizes para o solver
    optimization_type = data.get("optimizationType")
    if optimization_type not in {"maximize", "minimize"}:
        raise LinearProgramError("Escolha se deseja maximizar ou minimizar.")

    variable_count = int(data.get("variableCount", 0))
    if variable_count <= 0:
        raise LinearProgramError("Informe pelo menos uma variável.")

    variable_names = [
        _clean_variable_name(name, index)
        for index, name in enumerate(data.get("variableNames", []))
    ]
    if len(variable_names) != variable_count:
        variable_names = [f"x{index + 1}" for index in range(variable_count)]

    objective = _parse_coefficients(data.get("objective", []), variable_count, "função objetivo")
    non_negative = _parse_non_negative(data.get("nonNegative", []), variable_count)

    a_ub = []
    b_ub = []
    a_eq = []
    b_eq = []
    original_constraints = []

    for index, constraint in enumerate(data.get("constraints", []), start=1):
        coefficients = _parse_coefficients(
            constraint.get("coefficients", []),
            variable_count,
            f"restrição {index}",
        )
        operator = constraint.get("operator")
        rhs = _parse_number(constraint.get("rhs"), f"lado direito da restrição {index}")

        original_constraints.append({
            "coefficients": coefficients,
            "operator": operator,
            "rhs": rhs,
        })

        if operator == "<=":
            a_ub.append(coefficients)
            b_ub.append(rhs)
        elif operator == ">=":
            a_ub.append([-value for value in coefficients])
            b_ub.append(-rhs)
        elif operator == "=":
            a_eq.append(coefficients)
            b_eq.append(rhs)
        else:
            raise LinearProgramError(f"Operador inválido na restrição {index}.")

    return ParsedProblem(
        optimization_type=optimization_type,
        objective=objective,
        variable_names=variable_names,
        a_ub=a_ub,
        b_ub=b_ub,
        a_eq=a_eq,
        b_eq=b_eq,
        non_negative=non_negative,
        original_constraints=original_constraints,
    )


def _parse_coefficients(values: list, expected_count: int, field_name: str) -> list[float]:
    if len(values) != expected_count:
        raise LinearProgramError(f"A {field_name} deve ter {expected_count} coeficientes.")
    return [_parse_number(value, field_name) for value in values]


def _parse_number(value, field_name: str) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        raise LinearProgramError(f"Valor inválido em {field_name}.")


def _parse_non_negative(values: list, expected_count: int) -> list[bool]:
    if len(values) != expected_count:
        return [True for _ in range(expected_count)]
    return [bool(value) for value in values]


def _clean_variable_name(name: str, index: int) -> str:
    name = str(name or "").strip()
    return name if name else f"x{index + 1}"


def _calculate_slacks(constraints: list[dict], variable_values) -> list[dict]:
    # calcula a folga para indicar quais restricoes estao ativas
    slacks = []

    for index, constraint in enumerate(constraints, start=1):
        lhs = sum(coef * value for coef, value in zip(constraint["coefficients"], variable_values))
        rhs = constraint["rhs"]
        operator = constraint["operator"]

        if operator == "<=":
            slack = rhs - lhs
        elif operator == ">=":
            slack = lhs - rhs
        else:
            slack = abs(lhs - rhs)

        slacks.append({
            "constraint": index,
            "lhs": _round_float(lhs),
            "operator": operator,
            "rhs": _round_float(rhs),
            "slack": _round_float(slack),
            "active": bool(abs(float(slack)) <= 1e-7),
        })

    return slacks


def _translate_solver_message(message: str) -> str:
    if "infeasible" in message.lower():
        return "O problema não possui solução viável com as restrições informadas."
    if "unbounded" in message.lower():
        return "O problema é ilimitado. A função objetivo pode crescer ou diminuir sem limite."
    return message


def _round_float(value: float) -> float:
    rounded = round(float(value), 6)
    return 0.0 if abs(rounded) < 1e-9 else rounded
