use anyhow::Result;
use crate::dsl::Interpreter;
use rustyline::error::ReadlineError;
use rustyline::Editor;

/// Interactive REPL for HuaHuo Script.
pub fn run(initial_file: Option<String>) -> Result<()> {
    println!("HuaHuo Script REPL  (type `exit` or Ctrl-D to quit, `help` for commands)");
    println!("─────────────────────────────────────────────────────────────────────────");

    let mut interp = Interpreter::new();

    // Pre-load a file if given
    if let Some(ref path) = initial_file {
        if path.ends_with(".hhs") {
            println!("Running script '{}'…", path);
            if let Err(e) = interp.run_file(path) {
                eprintln!("Error in '{}': {}", path, e);
            }
        } else {
            // Treat as .hhk — inject a load() call
            println!("Loading project '{}'…", path);
            let src = format!("load(\"{}\")", path);
            if let Err(e) = interp.run_str(&src) {
                eprintln!("Error loading '{}': {}", path, e);
            }
        }
    }

    let mut rl = Editor::<()>::new()?;
    // Try loading history from .hhk_history in the current working directory (optional)
    let hist_path = std::path::Path::new(".hhk_history");
    let _ = rl.load_history(hist_path);

    let mut pending: Vec<String> = Vec::new(); // accumulates multi-line input

    loop {
        let prompt = if pending.is_empty() { "hhs> " } else { "  ... " };

        match rl.readline(prompt) {
            Ok(line) => {
                if !line.trim().is_empty() {
                    let _ = rl.add_history_entry(line.as_str());
                }
                let trimmed = line.as_str();

                // Special REPL commands
                match trimmed {
                    "exit" | "quit" => break,
                    "help" => {
                        print_help();
                        pending.clear();
                        continue;
                    }
                    "" => {
                        // Empty line: flush accumulated lines if any
                        if !pending.is_empty() {
                            let src = pending.join("\n");
                            pending.clear();
                            exec_src(&mut interp, &src);
                        }
                        continue;
                    }
                    // Trailing backslash → line continuation
                    s if s.ends_with('\\') => {
                        pending.push(s.trim_end_matches('\\').to_string());
                        continue;
                    }
                    _ => {}
                }

                pending.push(trimmed.to_string());

                // Try to execute the accumulated lines
                let src = pending.join("\n");
                match try_parse_complete(&src) {
                    ParseStatus::Complete => {
                        pending.clear();
                        exec_src(&mut interp, &src);
                    }
                    ParseStatus::Incomplete => {
                        // Wait for more input
                    }
                    ParseStatus::Error => {
                        // Execute anyway (will produce error message)
                        pending.clear();
                        exec_src(&mut interp, &src);
                    }
                }
            }
            Err(ReadlineError::Eof) => {
                // Ctrl-D
                println!();
                break;
            }
            Err(ReadlineError::Interrupted) => {
                // Ctrl-C: clear pending input and continue
                pending.clear();
                continue;
            }
            Err(e) => {
                eprintln!("Input error: {}", e);
                break;
            }
        }
    }

    // Try to save history; ignore errors
    let hist_path = std::path::Path::new(".hhk_history");
    let _ = rl.save_history(hist_path);

    println!("Bye!");
    Ok(())
}

fn exec_src(interp: &mut Interpreter, src: &str) {
    if let Err(e) = interp.run_str(src) {
        eprintln!("  ✗ {}", e);
    }
}

/// Very lightweight completeness check:
/// if the line has balanced parens and is not a bare ident (more expected),
/// treat it as complete.
enum ParseStatus { Complete, Incomplete, Error }

fn try_parse_complete(src: &str) -> ParseStatus {
    let mut depth = 0i32;
    for ch in src.chars() {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth < 0 { return ParseStatus::Error; }
            }
            _ => {}
        }
    }
    if depth == 0 { ParseStatus::Complete } else { ParseStatus::Incomplete }
}

fn print_help() {
    let help = [
        "",
        "HuaHuo Script REPL -- quick reference",
        "----------------------------------------------------------------------",
        "Project:",
        "  new_project(\"name\", fps=30, w=800, h=600)",
        "  load(\"file.hhk\")",
        "  save() / save(\"out.hhk\")",
        "  project.info()  project.list_scenes()",
        "  project.set_fps(60)  project.set_size(1920, 1080)",
        "",
        "Scenes:",
        "  let s = project.scene(\"name_or_id\")",
        "  let s = project.new_scene(\"name\", fps=24, duration=8)",
        "  s.info()  s.list_layers()",
        "  s.set_fps(fps)  s.set_duration(secs)",
        "",
        "Layers:",
        "  let l = s.layer(\"name_or_id\")",
        "  let l = s.new_layer(\"name\")",
        "  l.info()  l.list_gos()",
        "  l.set_visible(bool)  l.set_locked(bool)",
        "",
        "GameObjects:",
        "  let g = l.go(\"name_or_id\")",
        "  let g = l.new_go(\"name\", born=0)",
        "  g.info()  g.list_components()  g.list_kf()",
        "  g.add_component(\"Transform\")",
        "  g.set_kf(\"Comp\", \"prop\", frame=N, value=vec2(x,y), easing=\"linear\")",
        "  g.rm_kf(\"Comp\", \"prop\", frame=N)",
        "  g.set_active(bool)  g.set_born(frame)",
        "  g.interpolate(frame=N)",
        "",
        "Value constructors:",
        "  float(1.5)  int(3)  bool(true)  str(\"hello\")",
        "  vec2(x, y)  vec3(x, y, z)",
        "  color(r, g, b, a)   # 0-255",
        "  hex(\"#FF8800\")",
        "",
        "Easing:  linear  step  ease-in  ease-out  ease-in-out",
        "         bezier:x1,y1,x2,y2",
        "",
        "Variables:  let x = ...   (chain with x.method())",
        "REPL:       exit / quit   help   (blank line flushes buffer)",
        "",
        "Files:",
        "  files_import(\"local/logo.png\", \"/assets/images/logo.png\")",
        "  files_export(\"/assets/images/logo.png\", \"local/out.png\")",
        "  files_list()                          # list all files",
        "  files_list(\"/assets\")                # list /assets/ (direct children)",
        "  files_list(\"/assets\", recursive=true) # list /assets/ recursively",
        "  files_rm(\"/assets/images/logo.png\")",
        "  files_mv(\"/old/path.png\", \"/new/path.png\")",
        "  files_info(\"/assets/images/logo.png\")",
        "  (always call save() afterwards to persist changes)",
        "",
        "Hashing:",
        "  md5_str(\"hello world\")   # MD5 of a string",
        "  md5(\"/bin/hhk.exe\")      # MD5 of an embedded file in the project",
        "Custom commands (user scripts):",
        "  Put a .hhs file at /bin/<name>.hhs in the project, then call name()",
        "  Example:",
        "    files_import(\"./my_cmd.hhs\", \"/bin/my_cmd.hhs\")",
        "    save()",
        "    my_cmd()   # executes the script",
        "----------------------------------------------------------------------",
        "",
    ];
    for line in &help {
        println!("{}", line);
    }
}

