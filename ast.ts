import type { Token } from "./token.ts";

export type Node = {
  tokenLiteral(): string;
};

/* ----------------------------------------------------------------------------
 * Expressions
 * -------------------------------------------------------------------------- */

export class Identifier implements Node {
  public constructor(public token: Token, public value: string) { }

  public tokenLiteral(): string {
    return this.token.literal;
  }

  public toString(): string {
    return this.value;
  }
}

export type Expression = Identifier;

/* ----------------------------------------------------------------------------
 * Statements
 * -------------------------------------------------------------------------- */

export class LetStatement implements Node {
  public readonly type = "LetStatement";

  public constructor(
    public token: Token,
    public name: Identifier,
    public value: Expression | null
  ) { }

  public tokenLiteral(): string {
    return this.token.literal;
  }

  public toString(): string {
    const value = this.value ? this.value.toString() : "";
    return `${this.tokenLiteral()} ${this.name.toString()} = ${value};`;
  }
}

export class ReturnStatement implements Node {
  public readonly type = "ReturnStatement";

  public constructor(
    public token: Token,
    public returnValue: Expression | null
  ) { }

  public tokenLiteral(): string {
    return this.token.literal;
  }

  public toString(): string {
    const value = this.returnValue ? this.returnValue.toString() : "";
    return `${this.tokenLiteral()} ${value};`;
  }
}

export class ExpressionStatement implements Node {
  public readonly type = "ExpressionStatement";

  public constructor(
    public token: Token,
    public expression: Expression | null
  ) { }

  public tokenLiteral(): string {
    return this.token.literal;
  }

  public toString(): string {
    return this.expression ? this.expression.toString() : "";
  }
}

export type Statement = LetStatement | ReturnStatement | ExpressionStatement;

/* -------------------------------------------------------------------------- */

export class Program implements Node {
  public constructor(public statements: Array<Statement> = []) { }

  public tokenLiteral(): string {
    if (this.statements[0]) {
      return this.statements[0].tokenLiteral();
    }
    return "";
  }

  public toString(): string {
    let out = "";
    for (let i = 0; i < this.statements.length; i++) {
      out += this.statements[i]!.toString();
    }
    return out;
  }
}