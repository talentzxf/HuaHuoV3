//! Lexer for HuaHuo Script (`.hhs`).
//!
//! Tokens are kept minimal — the grammar is line-oriented with
//! no operator precedence (no expressions, only literals & calls).

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // keywords
    Let,
    // literals
    Ident(String),
    StringLit(String),
    IntLit(i64),
    FloatLit(f64),
    BoolLit(bool),
    // punctuation
    Eq,       // =
    Dot,      // .
    Comma,    // ,
    LParen,   // (
    RParen,   // )
    // end
    Newline,
    Eof,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Span {
    pub line: usize,
    pub col: usize,
}

#[derive(Debug, Clone)]
pub struct Spanned<T> {
    pub value: T,
    pub span: Span,
}

pub struct Lexer<'a> {
    src: &'a [u8],
    pos: usize,
    line: usize,
    col: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(src: &'a str) -> Self {
        Self {
            src: src.as_bytes(),
            pos: 0,
            line: 1,
            col: 1,
        }
    }

    pub fn tokenize(&mut self) -> anyhow::Result<Vec<Spanned<Token>>> {
        let mut tokens = Vec::new();
        loop {
            self.skip_whitespace_inline();
            if self.pos >= self.src.len() {
                tokens.push(self.spanned(Token::Eof));
                break;
            }
            let ch = self.src[self.pos] as char;

            // comment
            if ch == '#' {
                self.skip_to_eol();
                continue;
            }
            // newline
            if ch == '\n' {
                let sp = self.spanned(Token::Newline);
                tokens.push(sp);
                self.advance();
                continue;
            }
            if ch == '\r' {
                self.advance();
                continue;
            }

            let tok = match ch {
                '=' => { self.advance(); Token::Eq }
                '.' => { self.advance(); Token::Dot }
                ',' => { self.advance(); Token::Comma }
                '(' => { self.advance(); Token::LParen }
                ')' => { self.advance(); Token::RParen }
                '"' | '\'' => self.read_string()?,
                '-' | '0'..='9' => self.read_number()?,
                'a'..='z' | 'A'..='Z' | '_' => self.read_ident_or_keyword(),
                other => anyhow::bail!("line {}: unexpected character '{}'", self.line, other),
            };
            tokens.push(self.spanned(tok));
        }
        Ok(tokens)
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    fn cur_span(&self) -> Span {
        Span { line: self.line, col: self.col }
    }

    fn spanned(&self, t: Token) -> Spanned<Token> {
        Spanned { value: t, span: self.cur_span() }
    }

    fn advance(&mut self) {
        if self.pos < self.src.len() {
            if self.src[self.pos] == b'\n' {
                self.line += 1;
                self.col = 1;
            } else {
                self.col += 1;
            }
            self.pos += 1;
        }
    }

    fn skip_whitespace_inline(&mut self) {
        while self.pos < self.src.len() {
            let c = self.src[self.pos];
            if c == b' ' || c == b'\t' {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn skip_to_eol(&mut self) {
        while self.pos < self.src.len() && self.src[self.pos] != b'\n' {
            self.advance();
        }
    }

    fn read_string(&mut self) -> anyhow::Result<Token> {
        let quote = self.src[self.pos];
        self.advance(); // skip opening quote
        let mut s = String::new();
        loop {
            if self.pos >= self.src.len() {
                anyhow::bail!("line {}: unterminated string literal", self.line);
            }
            let c = self.src[self.pos];
            if c == quote {
                self.advance();
                break;
            }
            if c == b'\\' {
                self.advance();
                let esc = match self.src.get(self.pos).copied() {
                    Some(b'n') => '\n',
                    Some(b't') => '\t',
                    Some(b'\\') => '\\',
                    Some(b'"') => '"',
                    Some(b'\'') => '\'',
                    _ => anyhow::bail!("line {}: unknown escape", self.line),
                };
                s.push(esc);
                self.advance();
            } else {
                s.push(c as char);
                self.advance();
            }
        }
        Ok(Token::StringLit(s))
    }

    fn read_number(&mut self) -> anyhow::Result<Token> {
        let start = self.pos;
        let mut has_dot = false;
        // optional leading minus
        if self.src[self.pos] == b'-' {
            self.advance();
        }
        while self.pos < self.src.len() {
            match self.src[self.pos] {
                b'0'..=b'9' => { self.advance(); }
                b'.' if !has_dot => {
                    has_dot = true;
                    self.advance();
                }
                _ => break,
            }
        }
        let s = std::str::from_utf8(&self.src[start..self.pos]).unwrap();
        if has_dot {
            Ok(Token::FloatLit(s.parse::<f64>().map_err(|e| anyhow::anyhow!("bad float '{}': {}", s, e))?))
        } else {
            Ok(Token::IntLit(s.parse::<i64>().map_err(|e| anyhow::anyhow!("bad int '{}': {}", s, e))?))
        }
    }

    fn read_ident_or_keyword(&mut self) -> Token {
        let start = self.pos;
        while self.pos < self.src.len() {
            match self.src[self.pos] {
                b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'_' => { self.advance(); }
                _ => break,
            }
        }
        let s = std::str::from_utf8(&self.src[start..self.pos]).unwrap();
        match s {
            "let"   => Token::Let,
            "true"  => Token::BoolLit(true),
            "false" => Token::BoolLit(false),
            _       => Token::Ident(s.to_string()),
        }
    }
}

