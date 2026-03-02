use clap::{Parser, Subcommand};
use anyhow::Result;

mod commands;

#[derive(Parser)]
#[command(
    name = "hhk",
    about = "HuaHuo Kernel CLI - Animation project tool",
    version = "0.1.0"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Create a new animation project
    New {
        /// Project name
        name: String,
        /// Output file path
        #[arg(short, long, default_value = "project.hhk")]
        output: String,
        /// Frames per second
        #[arg(long, default_value = "30")]
        fps: f64,
        /// Canvas width
        #[arg(long, default_value = "800")]
        width: u32,
        /// Canvas height
        #[arg(long, default_value = "600")]
        height: u32,
    },
    /// Export a project to JSON or other formats
    Export {
        /// Input .hhk file
        input: String,
        /// Output file path
        #[arg(short, long)]
        output: Option<String>,
        /// Export format: json, binary
        #[arg(short, long, default_value = "json")]
        format: String,
    },
    /// Validate a project file
    Validate {
        /// Input .hhk file
        input: String,
    },
    /// Show project info
    Info {
        /// Input .hhk file
        input: String,
    },
}

fn main() -> Result<()> {
    env_logger::init();
    let cli = Cli::parse();

    match cli.command {
        Commands::New { name, output, fps, width, height } => {
            commands::new::run(name, output, fps, width, height)
        }
        Commands::Export { input, output, format } => {
            commands::export::run(input, output, format)
        }
        Commands::Validate { input } => {
            commands::validate::run(input)
        }
        Commands::Info { input } => {
            commands::info::run(input)
        }
    }
}

