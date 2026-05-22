from flask import Flask, jsonify, render_template, request

from reports import build_report
from solver import LinearProgramError, solve_linear_program


app = Flask(__name__)


@app.get("/")
def index():
    # mostra a tela principal
    return render_template("index.html")


@app.post("/solve")
def solve():
    # recebe o modelo enviado pelo javascript
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"success": False, "error": "Nenhum dado foi enviado."}), 400

    try:
        # resolve o problema e monta o relatorio
        solution = solve_linear_program(data)
        report = build_report(data, solution)
    except LinearProgramError as error:
        return jsonify({"success": False, "error": str(error)}), 400

    return jsonify({
        "success": True,
        "solution": solution,
        "report": report,
    })


if __name__ == "__main__":
    app.run(debug=False)
