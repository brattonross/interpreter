import { expect, test } from "vitest";
import type {
  ArrayExpression,
  BooleanExpression,
  CallExpression,
  ExpressionStatement,
  FunctionExpression,
  HashExpression,
  IdentifierExpression,
  IfExpression,
  IndexExpression,
  InfixExpression,
  IntegerExpression,
  LetStatement,
  PrefixExpression,
  ReturnStatement,
  StringExpression,
} from "./ast.ts";
import { Lexer } from "./lexer.ts";
import { Parser } from "./parser.ts";

test("let statements", () => {
  const tests = [
    ["let x = 5;", "x", 5],
    ["let y = true;", "y", true],
    ["let foobar = y;", "foobar", "y"],
  ] as const;

  for (const [input, expectedIdentifier, expectedValue] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.statements.length).toBe(1);

    const statement = program.statements[0] as LetStatement;
    expect(statement.tokenLiteral()).toBe("let");
    expect(statement.name.value).toBe(expectedIdentifier);
    expect(statement.name.tokenLiteral()).toBe(expectedIdentifier);

    const value = statement.value!;
    if (!("value" in value)) {
      throw new Error(
        "Expected value to be an expression with a value property"
      );
    }
    expect(value.value).toBe(expectedValue);
    expect(value.tokenLiteral()).toBe(expectedValue.toString());
  }
});

test("return statements", () => {
  const tests = [
    ["return 5;", 5],
    ["return true;", true],
    ["return foobar;", "foobar"],
  ] as const;

  for (const [input, expectedValue] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.statements.length).toBe(1);

    const statement = program.statements[0] as ReturnStatement;
    expect(statement.tokenLiteral()).toBe("return");

    const value = statement.returnValue!;
    if (!("value" in value)) {
      throw new Error(
        "Expected value to be an expression with a value property"
      );
    }
    expect(value.value).toBe(expectedValue);
    expect(value.tokenLiteral()).toBe(expectedValue.toString());
  }
});

test("identifier expression", () => {
  const input = "foobar;";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const identifier = statement.expression as IdentifierExpression;

  expect(identifier.value).toBe("foobar");
  expect(identifier.tokenLiteral()).toBe("foobar");
});

test("integer literal expression", () => {
  const input = "5;";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const literal = statement.expression as IntegerExpression;
  expect(literal.value).toBe(5);
  expect(literal.tokenLiteral()).toBe("5");
});

test("string literal expression", () => {
  const input = `"hello world";`;

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const literal = statement.expression as StringExpression;
  expect(literal.value).toBe("hello world");
  expect(literal.tokenLiteral()).toBe("hello world");
});

test("prefix expression", () => {
  const tests = [
    ["!5;", "!", 5],
    ["-15;", "-", 15],
    ["!true;", "!", true],
    ["!false;", "!", false],
  ] as const;

  for (const [input, operator, value] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.statements.length).toBe(1);

    const statement = program.statements[0] as ExpressionStatement;
    const expression = statement.expression as PrefixExpression;

    expect(expression.operator).toBe(operator);

    const integerLiteral = expression.right as IntegerExpression;
    expect(integerLiteral.value).toBe(value);
    expect(integerLiteral.tokenLiteral()).toBe(`${value}`);
  }
});

test("infix expressions", () => {
  const tests = [
    ["5 + 5;", 5, "+", 5],
    ["5 - 5;", 5, "-", 5],
    ["5 * 5;", 5, "*", 5],
    ["5 / 5;", 5, "/", 5],
    ["5 > 5;", 5, ">", 5],
    ["5 < 5;", 5, "<", 5],
    ["5 == 5;", 5, "==", 5],
    ["5 != 5;", 5, "!=", 5],
    ["true == true", true, "==", true],
    ["true != false", true, "!=", false],
    ["false == false", false, "==", false],
  ] as const;

  for (const [input, leftValue, operator, rightValue] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.statements.length).toBe(1);

    const statement = program.statements[0] as ExpressionStatement;
    const expression = statement.expression as InfixExpression;

    const left = expression.left as IntegerExpression;
    expect(left.value).toBe(leftValue);
    expect(left.tokenLiteral()).toBe(`${leftValue}`);

    expect(expression.operator).toBe(operator);

    const right = expression.right as IntegerExpression;
    expect(right.value).toBe(rightValue);
    expect(right.tokenLiteral()).toBe(`${rightValue}`);
  }
});

test("operator precedence", () => {
  const tests = [
    ["-a * b", "((-a) * b)"],
    ["!-a", "(!(-a))"],
    ["a + b + c", "((a + b) + c)"],
    ["a + b - c", "((a + b) - c)"],
    ["a * b * c", "((a * b) * c)"],
    ["a * b / c", "((a * b) / c)"],
    ["a + b / c", "(a + (b / c))"],
    ["a + b * c + d / e - f", "(((a + (b * c)) + (d / e)) - f)"],
    ["3 + 4; -5 * 5", "(3 + 4)((-5) * 5)"],
    ["5 > 4 == 3 < 4", "((5 > 4) == (3 < 4))"],
    ["5 < 4 != 3 > 4", "((5 < 4) != (3 > 4))"],
    ["3 + 4 * 5 == 3 * 1 + 4 * 5", "((3 + (4 * 5)) == ((3 * 1) + (4 * 5)))"],
    ["true", "true"],
    ["false", "false"],
    ["3 > 5 == false", "((3 > 5) == false)"],
    ["3 < 5 == true", "((3 < 5) == true)"],
    ["1 + (2 + 3) + 4", "((1 + (2 + 3)) + 4)"],
    ["(5 + 5) * 2", "((5 + 5) * 2)"],
    ["2 / (5 + 5)", "(2 / (5 + 5))"],
    ["-(5 + 5)", "(-(5 + 5))"],
    ["!(true == true)", "(!(true == true))"],
    ["a + add(b * c) + d", "((a + add((b * c))) + d)"],
    [
      "add(a, b, 1, 2 * 3, 4 + 5, add(6, 7 * 8))",
      "add(a, b, 1, (2 * 3), (4 + 5), add(6, (7 * 8)))",
    ],
    ["add(a + b + c * d / f + g)", "add((((a + b) + ((c * d) / f)) + g))"],
    ["a * [1, 2, 3, 4][b * c] * d", "((a * ([1, 2, 3, 4][(b * c)])) * d)"],
    [
      "add(a * b[2], b[1], 2 * [1, 2][1])",
      "add((a * (b[2])), (b[1]), (2 * ([1, 2][1])))",
    ],
  ] as const;

  for (const [input, expected] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.toString()).toBe(expected);
  }
});

test("boolean expression", () => {
  const tests = [
    ["true;", true],
    ["false;", false],
  ] as const;

  for (const [input, value] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.statements.length).toBe(1);

    const statement = program.statements[0] as ExpressionStatement;
    const boolean = statement.expression as BooleanExpression;

    expect(boolean.value).toBe(value);
    expect(boolean.tokenLiteral()).toBe(`${value}`);
  }
});

test("if expression", () => {
  const input = "if (x < y) { x }";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as IfExpression;

  expect(expression.condition?.toString()).toBe("(x < y)");
  expect(expression.consequence?.statements.length).toBe(1);

  const consequence = expression.consequence
    ?.statements[0] as ExpressionStatement;
  const identifier = consequence.expression as IdentifierExpression;
  expect(identifier.value).toBe("x");
  expect(identifier.tokenLiteral()).toBe("x");

  expect(expression.alternative).toBeNull();
});

test("if else expression", () => {
  const input = "if (x < y) { x } else { y }";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as IfExpression;

  expect(expression.condition?.toString()).toBe("(x < y)");
  expect(expression.consequence?.statements.length).toBe(1);

  const consequence = expression.consequence
    ?.statements[0] as ExpressionStatement;
  const identifier = consequence.expression as IdentifierExpression;
  expect(identifier.value).toBe("x");
  expect(identifier.tokenLiteral()).toBe("x");

  expect(expression.alternative?.statements.length).toBe(1);

  const alternative = expression.alternative
    ?.statements[0] as ExpressionStatement;
  const identifier2 = alternative.expression as IdentifierExpression;
  expect(identifier2.value).toBe("y");
  expect(identifier2.tokenLiteral()).toBe("y");
});

test("function expression", () => {
  const input = "fn(x, y) { x + y; }";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as FunctionExpression;

  expect(expression.parameters.length).toBe(2);

  const param1 = expression.parameters[0] as IdentifierExpression;
  expect(param1.value).toBe("x");
  expect(param1.tokenLiteral()).toBe("x");

  const param2 = expression.parameters[1] as IdentifierExpression;
  expect(param2.value).toBe("y");
  expect(param2.tokenLiteral()).toBe("y");

  expect(expression.body?.statements.length).toBe(1);

  const body = expression.body?.statements[0] as ExpressionStatement;
  const bodyExpression = body.expression as InfixExpression;

  const left = bodyExpression.left as IdentifierExpression;
  expect(left.value).toBe("x");
  expect(left.tokenLiteral()).toBe("x");

  expect(bodyExpression.operator).toBe("+");

  const right = bodyExpression.right as IdentifierExpression;
  expect(right.value).toBe("y");
  expect(right.tokenLiteral()).toBe("y");
});

test("function parameters", () => {
  const tests = [
    ["fn() {};", []],
    ["fn(x) {};", ["x"]],
    ["fn(x, y, z) {};", ["x", "y", "z"]],
  ] as const;

  for (const [input, expected] of tests) {
    const lexer = new Lexer(input);
    const parser = new Parser(lexer);

    const program = parser.parseProgram();
    expect(parser.errors.length).toBe(0);
    expect(program.statements.length).toBe(1);

    const statement = program.statements[0] as ExpressionStatement;
    const expression = statement.expression as FunctionExpression;

    expect(expression.parameters.length).toBe(expected.length);

    for (let i = 0; i < expected.length; i++) {
      const param = expression.parameters[i] as IdentifierExpression;
      expect(param.value).toBe(expected[i]);
      expect(param.tokenLiteral()).toBe(expected[i]);
    }
  }
});

test("call expression", () => {
  const input = "add(1, 2 * 3, 4 + 5);";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as CallExpression;

  const identifier = expression.func as IdentifierExpression;
  expect(identifier.value).toBe("add");
  expect(identifier.tokenLiteral()).toBe("add");

  expect(expression.args.length).toBe(3);

  const arg1 = expression.args[0] as IntegerExpression;
  expect(arg1.value).toBe(1);
  expect(arg1.tokenLiteral()).toBe("1");

  const arg2 = expression.args[1] as InfixExpression;
  const arg2Left = arg2.left as IntegerExpression;
  expect(arg2Left.value).toBe(2);
  expect(arg2Left.tokenLiteral()).toBe("2");
  expect(arg2.operator).toBe("*");
  const arg2Right = arg2.right as IntegerExpression;
  expect(arg2Right.value).toBe(3);
  expect(arg2Right.tokenLiteral()).toBe("3");

  const arg3 = expression.args[2] as InfixExpression;
  const arg3Left = arg3.left as IntegerExpression;
  expect(arg3Left.value).toBe(4);
  expect(arg3Left.tokenLiteral()).toBe("4");
  expect(arg3.operator).toBe("+");
  const arg3Right = arg3.right as IntegerExpression;
  expect(arg3Right.value).toBe(5);
  expect(arg3Right.tokenLiteral()).toBe("5");
});

test("parse array literals", () => {
  const input = "[1, 2 * 2, 3 + 3]";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);
  expect(program.statements.length).toBe(1);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as ArrayExpression;

  expect(expression.elements.length).toBe(3);

  const element1 = expression.elements[0] as IntegerExpression;
  expect(element1.value).toBe(1);
  expect(element1.tokenLiteral()).toBe("1");

  const element2 = expression.elements[1] as InfixExpression;
  const element2Left = element2.left as IntegerExpression;
  expect(element2Left.value).toBe(2);
  expect(element2Left.tokenLiteral()).toBe("2");
  expect(element2.operator).toBe("*");
  const element2Right = element2.right as IntegerExpression;
  expect(element2Right.value).toBe(2);
  expect(element2Right.tokenLiteral()).toBe("2");

  const element3 = expression.elements[2] as InfixExpression;
  const element3Left = element3.left as IntegerExpression;
  expect(element3Left.value).toBe(3);
  expect(element3Left.tokenLiteral()).toBe("3");
  expect(element3.operator).toBe("+");
  const element3Right = element3.right as IntegerExpression;
  expect(element3Right.value).toBe(3);
  expect(element3Right.tokenLiteral()).toBe("3");
});

test("parse index expressions", () => {
  const input = "myArray[1 + 1]";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as IndexExpression;

  const left = expression.left as IdentifierExpression;
  expect(left.value).toBe("myArray");
  expect(left.tokenLiteral()).toBe("myArray");

  const index = expression.index as InfixExpression;
  const indexLeft = index.left as IntegerExpression;
  expect(indexLeft.value).toBe(1);
  expect(indexLeft.tokenLiteral()).toBe("1");
  expect(index.operator).toBe("+");
  const indexRight = index.right as IntegerExpression;
  expect(indexRight.value).toBe(1);
  expect(indexRight.tokenLiteral()).toBe("1");
});

test("parse hash literals", () => {
  const input = '{"one": 1, "two": 2, "three": 3}';

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as HashExpression;

  expect(expression.pairs.size).toBe(3);

  const expected = new Map<string, number>([
    ["one", 1],
    ["two", 2],
    ["three", 3],
  ]);

  for (const [key, value] of expression.pairs) {
    const literal = key as StringExpression;
    const actual = value as IntegerExpression;

    expect(actual.value).toBe(expected.get(literal.value));
  }
});

test("parse empty hash literals", () => {
  const input = "{}";

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as HashExpression;

  expect(expression.pairs.size).toBe(0);
});

test("parse hash literals with expressions", () => {
  const input = '{"one": 0 + 1, "two": 10 - 8, "three": 15 / 5}';

  const lexer = new Lexer(input);
  const parser = new Parser(lexer);

  const program = parser.parseProgram();
  expect(parser.errors.length).toBe(0);

  const statement = program.statements[0] as ExpressionStatement;
  const expression = statement.expression as HashExpression;

  expect(expression.pairs.size).toBe(3);

  const expected = {
    one: [0, "+", 1],
    two: [10, "-", 8],
    three: [15, "/", 5],
  } as const;

  for (const [key, value] of expression.pairs) {
    const literal = key as StringExpression;
    const actual = value as InfixExpression;

    const [left, operator, right] =
      expected[literal.value as keyof typeof expected];

    const leftExpression = actual.left as IntegerExpression;
    expect(leftExpression.value).toBe(left);
    expect(leftExpression.tokenLiteral()).toBe(left.toString());

    expect(actual.operator).toBe(operator);

    const rightExpression = actual.right as IntegerExpression;
    expect(rightExpression.value).toBe(right);
    expect(rightExpression.tokenLiteral()).toBe(right.toString());
  }
});
