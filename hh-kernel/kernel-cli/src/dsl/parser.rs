//! Parser for HuaHuo Script.
//!
//! Grammar (simplified):
//!
//! ```
//! script      = stmt* EOF
//! stmt        = NEWLINE                         # blank line
//!             | "let" IDENT "=" expr NEWLINE
//!             | expr NEWLINE
//! expr        = call_chain
//! call_chain  = primary ( "." IDENT call_args? )*
//! primary     = IDENT call_args?                # bare ident or function call
//! call_args   = "(" arg_list? ")"
//! arg_list    = arg ("," arg)*
//! arg         = (IDENT "=")? value
//! value       = STRING | INT | FLOAT | BOOL
//!             | IDENT "(" arg_list? ")"         # value constructors: vec2(), color(), float(), …
//! ```

use crate::dsl::lexer::{Spanned, Token};
use anyhow::{bail, Result};

// ── AST ──────────────────────────────────────────────────────────────────────

/// A named or positional argument: `name=value` or just `value`.
#[derive(Debug, Clone)]
pub struct Arg {
    pub name: Option<String>,
    pub value: Value,
}

/// A literal value or value-constructor (vec2, color, …).
#[derive(Debug, Clone)]
pub enum Value {
    Str(String),
    Int(i64),
    Float(f64),
    Bool(bool),
    /// Constructor call: `vec2(0, 300)`, `color(255,0,128,255)`, `float(1.0)`
    Constructor { name: String, args: Vec<Value> },
}

/// A chained method call: `base.method(args).method2(args2)…`
#[derive(Debug, Clone)]
pub struct CallChain {
    /// Root — either a plain identifier or a function call.
    pub root: Expr,
    /// Each additional `.method(args)` segment.
    pub chain: Vec<ChainSegment>,
}

#[derive(Debug, Clone)]
pub struct ChainSegment {
    pub method: String,
    pub args: Vec<Arg>,
}

#[derive(Debug, Clone)]
pub enum Expr {
    /// Plain identifier used as a value, e.g. `project`, `go`
    Ident(String),
    /// Free-standing call, e.g. `load("foo.hhk")`, `save()`
    Call { name: String, args: Vec<Arg> },
    /// A full call chain
    Chain(Box<CallChain>),
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum Stmt {
    /// `let x = expr`
    Let { name: String, expr: Expr },
    /// Bare expression (side-effect call)
    Expr(Expr),
    /// Blank / comment line (already stripped by lexer)
    Blank,
}

// ── Parser ────────────────────────────────────────────────────────────────────

pub struct Parser {
    tokens: Vec<Spanned<Token>>,
    pos: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Spanned<Token>>) -> Self {
        Self { tokens, pos: 0 }
    }

    pub fn parse(&mut self) -> Result<Vec<Stmt>> {
        let mut stmts = Vec::new();
        loop {
            self.skip_newlines();
            if self.peek_is(Token::Eof) {
                break;
            }
            let stmt = self.parse_stmt()?;
            stmts.push(stmt);
        }
        Ok(stmts)
    }

    // ── statement ─────────────────────────────────────────────────────────────

    fn parse_stmt(&mut self) -> Result<Stmt> {
        if self.peek_is(Token::Let) {
            self.advance(); // consume `let`
            let name = self.expect_ident("expected variable name after `let`")?;
            self.expect(Token::Eq, "expected `=` after variable name")?;
            let expr = self.parse_expr()?;
            self.expect_newline_or_eof()?;
            Ok(Stmt::Let { name, expr })
        } else {
            let expr = self.parse_expr()?;
            self.expect_newline_or_eof()?;
            Ok(Stmt::Expr(expr))
        }
    }

    // ── expression / call chain ───────────────────────────────────────────────

    fn parse_expr(&mut self) -> Result<Expr> {
        // Root: ident (optionally followed by call_args → becomes a Call)
        let name = self.expect_ident("expected identifier")?;

        let root: Expr = if self.peek_is(Token::LParen) {
            let args = self.parse_call_args()?;
            Expr::Call { name, args }
        } else {
            Expr::Ident(name)
        };

        // Collect `.method(args)` segments
        let mut chain: Vec<ChainSegment> = Vec::new();
        while self.peek_is(Token::Dot) {
            self.advance(); // consume `.`
            let method = self.expect_ident("expected method name after `.`")?;
            let args = if self.peek_is(Token::LParen) {
                self.parse_call_args()?
            } else {
                vec![]
            };
            chain.push(ChainSegment { method, args });
        }

        if chain.is_empty() {
            Ok(root)
        } else {
            Ok(Expr::Chain(Box::new(CallChain { root, chain })))
        }
    }

    // ── argument list ─────────────────────────────────────────────────────────

    fn parse_call_args(&mut self) -> Result<Vec<Arg>> {
        self.expect(Token::LParen, "expected `(`")?;
        let mut args = Vec::new();
        while !self.peek_is(Token::RParen) {
            if !args.is_empty() {
                self.expect(Token::Comma, "expected `,` between arguments")?;
            }
            // Skip trailing commas
            if self.peek_is(Token::RParen) {
                break;
            }
            let arg = self.parse_arg()?;
            args.push(arg);
        }
        self.expect(Token::RParen, "expected `)`")?;
        Ok(args)
    }

    fn parse_arg(&mut self) -> Result<Arg> {
        // Look ahead: if `IDENT =` → named arg
        if let Some(name) = self.try_peek_named_arg() {
            self.advance(); // consume ident
            self.advance(); // consume `=`
            let value = self.parse_value()?;
            Ok(Arg { name: Some(name), value })
        } else {
            let value = self.parse_value()?;
            Ok(Arg { name: None, value })
        }
    }

    fn try_peek_named_arg(&self) -> Option<String> {
        if let Some(tok) = self.tokens.get(self.pos) {
            if let Token::Ident(ref n) = tok.value {
                if let Some(next) = self.tokens.get(self.pos + 1) {
                    if next.value == Token::Eq {
                        return Some(n.clone());
                    }
                }
            }
        }
        None
    }

    // ── value ─────────────────────────────────────────────────────────────────

    fn parse_value(&mut self) -> Result<Value> {
        let tok = self.peek().clone();
        match tok.value {
            Token::StringLit(ref s) => {
                let v = Value::Str(s.clone());
                self.advance();
                Ok(v)
            }
            Token::IntLit(n) => {
                self.advance();
                Ok(Value::Int(n))
            }
            Token::FloatLit(f) => {
                self.advance();
                Ok(Value::Float(f))
            }
            Token::BoolLit(b) => {
                self.advance();
                Ok(Value::Bool(b))
            }
            Token::Ident(ref name) => {
                let name = name.clone();
                self.advance();
                if self.peek_is(Token::LParen) {
                    // constructor: vec2(x,y), color(r,g,b,a), float(v), …
                    self.advance(); // (
                    let mut inner: Vec<Value> = Vec::new();
                    while !self.peek_is(Token::RParen) {
                        if !inner.is_empty() {
                            self.expect(Token::Comma, "expected `,` in constructor")?;
                        }
                        if self.peek_is(Token::RParen) { break; }
                        inner.push(self.parse_value()?);
                    }
                    self.expect(Token::RParen, "expected `)` in constructor")?;
                    Ok(Value::Constructor { name, args: inner })
                } else {
                    // bare ident used as string alias (e.g. variable reference)
                    Ok(Value::Constructor { name, args: vec![] })
                }
            }
            _ => bail!("line {}: expected a value, got {:?}", tok.span.line, tok.value),
        }
    }

    // ── token helpers ─────────────────────────────────────────────────────────

    fn peek(&self) -> &Spanned<Token> {
        &self.tokens[self.pos.min(self.tokens.len() - 1)]
    }

    fn peek_is(&self, t: Token) -> bool {
        self.peek().value == t
    }

    fn advance(&mut self) {
        if self.pos + 1 < self.tokens.len() {
            self.pos += 1;
        }
    }

    fn skip_newlines(&mut self) {
        while self.peek_is(Token::Newline) {
            self.advance();
        }
    }

    fn expect(&mut self, t: Token, msg: &str) -> Result<()> {
        if self.peek().value == t {
            self.advance();
            Ok(())
        } else {
            bail!("line {}: {} (got {:?})", self.peek().span.line, msg, self.peek().value)
        }
    }

    fn expect_ident(&mut self, msg: &str) -> Result<String> {
        if let Token::Ident(ref s) = self.peek().value.clone() {
            let s = s.clone();
            self.advance();
            Ok(s)
        } else {
            bail!("line {}: {} (got {:?})", self.peek().span.line, msg, self.peek().value)
        }
    }

    fn expect_newline_or_eof(&mut self) -> Result<()> {
        match self.peek().value {
            Token::Newline | Token::Eof => {
                if self.peek_is(Token::Newline) {
                    self.advance();
                }
                Ok(())
            }
            _ => bail!(
                "line {}: expected end of statement, got {:?}",
                self.peek().span.line,
                self.peek().value
            ),
        }
    }
}

