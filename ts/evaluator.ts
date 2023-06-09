import {
  BlockStatement,
  type Expression,
  IdentifierExpression,
  IfExpression,
  type NodeType,
  Program,
  HashExpression,
} from "./ast.ts";
import {
  BooleanObject,
  IntegerObject,
  NullObject,
  ReturnValueObject,
  type ObjectType,
  ErrorObject,
  Environment,
  FunctionObject,
  StringObject,
  BuiltinFunctionObject,
  ArrayObject,
  HashObject,
  type HashPair,
} from "./object.ts";

export const NULL = new NullObject();
export const TRUE = new BooleanObject(true);
export const FALSE = new BooleanObject(false);

const BUILTINS = {
  len: new BuiltinFunctionObject((...args) => {
    if (args.length !== 1) {
      return new ErrorObject(
        `wrong number of arguments. got=${args.length}, want=1`
      );
    }

    const arg = args[0];
    if (arg?.type === "ARRAY") {
      return new IntegerObject(arg.elements.length);
    } else if (arg?.type === "STRING") {
      return new IntegerObject(arg.value.length);
    }

    return new ErrorObject(
      `argument to \`len\` not supported, got ${arg?.type}`
    );
  }),
  first: new BuiltinFunctionObject((...args) => {
    if (args.length !== 1) {
      return new ErrorObject(
        `wrong number of arguments. got=${args.length}, want=1`
      );
    }

    const arg = args[0];
    if (arg?.type !== "ARRAY") {
      return new ErrorObject(
        `argument to \`first\` must be ARRAY, got ${arg?.type}`
      );
    }

    if (arg.elements.length > 0) {
      return arg.elements[0] ?? NULL;
    }

    return NULL;
  }),
  last: new BuiltinFunctionObject((...args) => {
    if (args.length !== 1) {
      return new ErrorObject(
        `wrong number of arguments. got=${args.length}, want=1`
      );
    }

    const arg = args[0];
    if (arg?.type !== "ARRAY") {
      return new ErrorObject(
        `argument to \`last\` must be ARRAY, got ${arg?.type}`
      );
    }

    if (arg.elements.length > 0) {
      return arg.elements[arg.elements.length - 1] ?? NULL;
    }

    return NULL;
  }),
  rest: new BuiltinFunctionObject((...args) => {
    if (args.length !== 1) {
      return new ErrorObject(
        `wrong number of arguments. got=${args.length}, want=1`
      );
    }

    const arg = args[0];
    if (arg?.type !== "ARRAY") {
      return new ErrorObject(
        `argument to \`rest\` must be ARRAY, got ${arg?.type}`
      );
    }

    if (arg.elements.length > 0) {
      return new ArrayObject(arg.elements.slice(1));
    }

    return NULL;
  }),
  push: new BuiltinFunctionObject((...args) => {
    if (args.length !== 2) {
      return new ErrorObject(
        `wrong number of arguments. got=${args.length}, want=2`
      );
    }

    const arg = args[0];
    if (arg?.type !== "ARRAY") {
      return new ErrorObject(
        `argument to \`push\` must be ARRAY, got ${arg?.type}`
      );
    }

    return new ArrayObject(arg.elements.concat(args[1]!));
  }),
  puts: new BuiltinFunctionObject((...args) => {
    args.forEach((arg) => console.log(arg?.inspect()));
    return NULL;
  }),
} as const;

export function evaluate(
  node: NodeType | null,
  env: Environment
): ObjectType | null {
  if (node === null) {
    return null;
  }

  switch (node.type) {
    case "PROGRAM":
      return evalProgram(node, env);

    case "EXPRESSION_STATEMENT":
      return evaluate(node.expression, env);

    case "INTEGER_EXPRESSION":
      return new IntegerObject(node.value);

    case "STRING_EXPRESSION":
      return new StringObject(node.value);

    case "BOOLEAN_EXPRESSION":
      return node.value ? TRUE : FALSE;

    case "PREFIX_EXPRESSION": {
      const right = evaluate(node.right, env);
      if (isError(right)) {
        return right;
      }
      return evalPrefixExpression(node.operator, right);
    }

    case "INFIX_EXPRESSION": {
      const left = evaluate(node.left, env);
      if (isError(left)) {
        return left;
      }
      const right = evaluate(node.right, env);
      if (isError(right)) {
        return right;
      }
      return evalInfixExpression(node.operator, left, right);
    }

    case "BLOCK_STATEMENT":
      return evalBlockStatement(node, env);

    case "IF_EXPRESSION":
      return evalIfExpression(node, env);

    case "RETURN_STATEMENT": {
      const value = evaluate(node.returnValue, env);
      if (isError(value)) {
        return value;
      }
      return new ReturnValueObject(value!);
    }

    case "LET_STATEMENT": {
      const value = evaluate(node.value, env);
      if (isError(value)) {
        return value;
      }

      env.set(node.name.value, value!);
      break;
    }

    case "IDENTIFIER_EXPRESSION": {
      return evalIdentifier(node, env);
    }

    case "FUNCTION_EXPRESSION": {
      return new FunctionObject(node.parameters, node.body, env);
    }

    case "CALL_EXPRESSION": {
      const fn = evaluate(node.func, env);
      if (isError(fn)) {
        return fn;
      }
      const args = evalExpressions(node.args, env);
      if (args.length === 1 && isError(args[0]!)) {
        return args[0];
      }
      return applyFunction(fn!, args);
    }

    case "ARRAY_EXPRESSION": {
      const elements = evalExpressions(node.elements, env);
      if (elements[0] !== undefined && isError(elements[0])) {
        return elements[0];
      }
      return new ArrayObject(elements);
    }

    case "INDEX_EXPRESSION": {
      const left = evaluate(node.left, env);
      if (isError(left)) {
        return left;
      }
      const index = evaluate(node.index, env);
      if (isError(index)) {
        return index;
      }
      return evalIndexExpression(left!, index!);
    }

    case "HASH_EXPRESSION": {
      return evalHashExpression(node, env);
    }
  }

  return null;
}

function applyFunction(
  fn: ObjectType,
  args: Array<ObjectType>
): ObjectType | null {
  if (fn.type === "FUNCTION") {
    const extendedEnv = extendFunctionEnv(fn, args);
    const evaluated = evaluate(fn.body, extendedEnv);
    return unwrapReturnValue(evaluated);
  } else if (fn.type === "BUILTIN_FUNCTION") {
    return fn.fn(...args);
  }

  return new ErrorObject(`not a function: ${fn.type}`);
}

function extendFunctionEnv(fn: FunctionObject, args: Array<ObjectType>) {
  const env = Environment.enclosed(fn.env);
  for (let i = 0; i < fn.parameters.length; i++) {
    env.set(fn.parameters[i]!.value, args[i]!);
  }
  return env;
}

function unwrapReturnValue(obj: ObjectType | null): ObjectType | null {
  if (obj?.type === "RETURN_VALUE") {
    return obj.value;
  }
  return obj;
}

function isError(obj: ObjectType | null): obj is ErrorObject {
  return obj?.type === "ERROR";
}

function evalExpressions(
  expressions: Array<Expression>,
  env: Environment
): Array<ObjectType> {
  let result: Array<ObjectType> = [];
  for (let i = 0; i < expressions.length; i++) {
    const evaluated = evaluate(expressions[i]!, env);
    if (isError(evaluated)) {
      return [evaluated];
    }
    result.push(evaluated!);
  }
  return result;
}

function evalIdentifier(
  node: IdentifierExpression,
  env: Environment
): ObjectType | null {
  const value = env.get(node.value);
  if (value) {
    return value;
  } else if (
    node.value in BUILTINS &&
    BUILTINS[node.value as keyof typeof BUILTINS].type === "BUILTIN_FUNCTION"
  ) {
    return BUILTINS[node.value as keyof typeof BUILTINS];
  }
  return new ErrorObject(`identifier not found: ${node.value}`);
}

function evalPrefixExpression(
  operator: string,
  right: ObjectType | null
): ObjectType {
  switch (operator) {
    case "!":
      return evalBangOperatorExpression(right);

    case "-":
      return evalMinusPrefixOperatorExpression(right);

    default:
      return new ErrorObject(`unknown operator: ${operator}${right?.type}`);
  }
}

function evalMinusPrefixOperatorExpression(
  right: ObjectType | null
): ObjectType {
  if (right?.type !== "INTEGER") {
    return new ErrorObject(`unknown operator: -${right?.type}`);
  }

  return new IntegerObject(-right.value);
}

function evalInfixExpression(
  operator: string,
  left: ObjectType | null,
  right: ObjectType | null
): ObjectType {
  if (left?.type === "INTEGER" && right?.type === "INTEGER") {
    return evalIntegerInfixExpression(operator, left, right);
  } else if (left?.type === "STRING" && right?.type === "STRING") {
    return evalStringInfixExpression(operator, left, right);
  } else if (operator === "==") {
    return left === right ? TRUE : FALSE;
  } else if (operator === "!=") {
    return left !== right ? TRUE : FALSE;
  } else if (left?.type !== right?.type) {
    return new ErrorObject(
      `type mismatch: ${left?.type} ${operator} ${right?.type}`
    );
  }

  return new ErrorObject(
    `unknown operator: ${left?.type} ${operator} ${right?.type}`
  );
}

function evalIntegerInfixExpression(
  operator: string,
  left: IntegerObject,
  right: IntegerObject
): ObjectType {
  const leftValue = left.value;
  const rightValue = right.value;

  switch (operator) {
    case "+":
      return new IntegerObject(leftValue + rightValue);

    case "-":
      return new IntegerObject(leftValue - rightValue);

    case "*":
      return new IntegerObject(leftValue * rightValue);

    case "/":
      return new IntegerObject(Math.floor(leftValue / rightValue));

    case "<":
      return leftValue < rightValue ? TRUE : FALSE;

    case ">":
      return leftValue > rightValue ? TRUE : FALSE;

    case "==":
      return leftValue === rightValue ? TRUE : FALSE;

    case "!=":
      return leftValue !== rightValue ? TRUE : FALSE;

    default:
      return new ErrorObject(
        `unknown operator: ${left.type} ${operator} ${right.type}`
      );
  }
}

function evalStringInfixExpression(
  operator: string,
  left: StringObject,
  right: StringObject
): ObjectType {
  if (operator !== "+") {
    return new ErrorObject(
      `unknown operator: ${left.type} ${operator} ${right.type}`
    );
  }

  return new StringObject(left.value + right.value);
}

function evalIfExpression(
  node: IfExpression,
  env: Environment
): ObjectType | null {
  const condition = evaluate(node.condition, env);
  if (isError(condition)) {
    return condition;
  } else if (isTruthy(condition)) {
    return evaluate(node.consequence, env);
  } else if (node.alternative) {
    return evaluate(node.alternative, env);
  } else {
    return NULL;
  }
}

function isTruthy(obj: ObjectType | null): boolean {
  switch (obj) {
    case NULL:
      return false;

    case TRUE:
      return true;

    case FALSE:
      return false;

    default:
      return true;
  }
}

function evalBangOperatorExpression(right: ObjectType | null): ObjectType {
  switch (right) {
    case TRUE:
      return FALSE;

    case FALSE:
      return TRUE;

    case NULL:
      return TRUE;

    default:
      return FALSE;
  }
}

function evalProgram(program: Program, env: Environment): ObjectType | null {
  let result: ObjectType | null = null;
  for (let i = 0; i < program.statements.length; i++) {
    result = evaluate(program.statements[i]!, env);

    if (result?.type === "RETURN_VALUE") {
      result = result.value;
      break;
    } else if (result?.type === "ERROR") {
      break;
    }
  }
  return result;
}

function evalBlockStatement(
  block: BlockStatement,
  env: Environment
): ObjectType | null {
  let result: ObjectType | null = null;
  for (let i = 0; i < block.statements.length; i++) {
    result = evaluate(block.statements[i]!, env);

    if (result === null) {
      continue;
    }

    if (result.type === "RETURN_VALUE" || result.type === "ERROR") {
      break;
    }
  }
  return result;
}

function evalIndexExpression(
  left: ObjectType | null,
  index: ObjectType | null
): ObjectType {
  if (left?.type === "ARRAY" && index?.type === "INTEGER") {
    return evalArrayIndexExpression(left, index);
  } else if (left?.type === "HASH") {
    return evalHashIndexExpression(left, index);
  }
  return new ErrorObject(`index operator not supported: ${left?.type}`);
}

function evalArrayIndexExpression(
  array: ArrayObject,
  index: IntegerObject
): ObjectType {
  const max = array.elements.length - 1;
  if (index.value < 0 || index.value > max) {
    return NULL;
  }
  return array.elements[index.value] ?? NULL;
}

function evalHashExpression(
  hash: HashExpression,
  env: Environment
): ObjectType {
  const pairs = new Map<number, HashPair>();

  for (const [keyNode, valueNode] of hash.pairs) {
    const key = evaluate(keyNode, env);
    if (isError(key)) {
      return key;
    }

    if (
      key === null ||
      !("hashCode" in key) ||
      typeof key.hashCode !== "function"
    ) {
      return new ErrorObject(`unusable as hash key: ${key?.type}`);
    }

    const value = evaluate(valueNode, env);
    if (isError(value)) {
      return value;
    }

    pairs.set(key.hashCode(), {
      key,
      value: value ?? NULL,
    });
  }

  return new HashObject(pairs);
}

function evalHashIndexExpression(
  hash: HashObject,
  index: ObjectType | null
): ObjectType {
  if (index === null || !("hashCode" in index)) {
    return new ErrorObject(`unusable as hash key: ${index?.type}`);
  }

  const pair = hash.pairs.get(index.hashCode());
  if (pair === undefined) {
    return NULL;
  }

  return pair.value;
}
