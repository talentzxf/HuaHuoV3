use anyhow::Result;
use crate::dsl::Interpreter;

pub fn run(script: String, dry_run: bool) -> Result<()> {
    let mut interp = Interpreter::new();
    interp.dry_run = dry_run;
    interp.run_file(&script)
}

