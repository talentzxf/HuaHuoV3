use clap::{Parser, Subcommand};
use anyhow::Result;

mod commands;
mod dsl;

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

    /// Run a HuaHuo Script (.hhs) file
    Run {
        /// Path to the .hhs script file
        script: String,
        /// Dry-run: parse and execute but do not write files
        #[arg(long)]
        dry_run: bool,
    },

    /// Dump a .hhk project as a human-readable .hhs script
    Dump {
        /// Input .hhk project file
        input: String,
        /// Output .hhs file (omit to print to stdout)
        #[arg(short, long)]
        output: Option<String>,
    },

    /// Start an interactive REPL for HuaHuo Script
    Repl {
        /// Optionally pre-load a .hhk or .hhs file before entering the REPL
        #[arg(short, long)]
        load: Option<String>,
    },

    // ── File management ───────────────────────────────────────────────────────
    /// Manage embedded resource files (images, audio, fonts, …)
    Files {
        #[command(subcommand)]
        action: FilesCommands,
    },
    /// Manage scenes in a project
    Scene {
        #[command(subcommand)]
        action: SceneCommands,
    },

    // ── Layer commands ────────────────────────────────────────────────────────
    /// Manage layers inside a scene
    Layer {
        #[command(subcommand)]
        action: LayerCommands,
    },

    // ── GameObject commands ───────────────────────────────────────────────────
    /// Manage game objects and their keyframes
    #[command(name = "go")]
    GameObject {
        #[command(subcommand)]
        action: GameObjectCommands,
    },
}

// ── Files subcommands ─────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum FilesCommands {
    /// Import a local file into the project at a virtual path.
    ///
    /// Example: hhk files import project.hhk ./logo.png /assets/images/logo.png
    Import {
        /// .hhk project file
        project: String,
        /// Local file to import
        local_file: String,
        /// Virtual destination path inside the project (e.g. /assets/images/logo.png)
        vfs_path: String,
    },

    /// Export (dump) an embedded file to the local filesystem.
    ///
    /// Example: hhk files export project.hhk /assets/images/logo.png ./logo.png
    Export {
        /// .hhk project file
        project: String,
        /// Virtual path inside the project
        vfs_path: String,
        /// Local output path
        local_output: String,
    },

    /// List embedded files (optionally filtered to a directory).
    ///
    /// Example: hhk files list project.hhk
    ///          hhk files list project.hhk --dir /assets
    ///          hhk files list project.hhk --dir /assets --recursive
    List {
        /// .hhk project file
        project: String,
        /// Filter to this virtual directory (default: /)
        #[arg(long, default_value = "/")]
        dir: Option<String>,
        /// List all files recursively under the directory
        #[arg(short, long)]
        recursive: bool,
    },

    /// Remove an embedded file by its virtual path.
    ///
    /// Example: hhk files rm project.hhk /assets/images/logo.png
    Rm {
        /// .hhk project file
        project: String,
        /// Virtual path of the file to remove
        vfs_path: String,
    },

    /// Move / rename an embedded file to a new virtual path.
    ///
    /// Example: hhk files mv project.hhk /logo.png /assets/images/logo.png
    Mv {
        /// .hhk project file
        project: String,
        /// Current virtual path of the file
        old_path: String,
        /// New virtual path for the file
        new_path: String,
    },

    /// Show metadata for an embedded file.
    ///
    /// Example: hhk files info project.hhk /assets/images/logo.png
    Info {
        /// .hhk project file
        project: String,
        /// Virtual path of the file
        vfs_path: String,
    },
}

// ── Scene subcommands ─────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum SceneCommands {
    /// Add a new scene to the project
    Add {
        /// .hhk project file
        input: String,
        /// Scene name
        name: String,
        /// Frames per second (defaults to project fps)
        #[arg(long)]
        fps: Option<f64>,
        /// Duration in seconds (default: 5)
        #[arg(long)]
        duration: Option<f64>,
    },
    /// List all scenes in the project
    List {
        /// .hhk project file
        input: String,
    },
    /// Set the current (active) scene
    SetCurrent {
        /// .hhk project file
        input: String,
        /// Scene ID to activate
        scene_id: String,
    },
    /// Remove a scene from the project
    Remove {
        /// .hhk project file
        input: String,
        /// Scene ID to remove
        scene_id: String,
    },
}

// ── Layer subcommands ─────────────────────────────────────────────────────────

#[derive(Subcommand)]
enum LayerCommands {
    /// Add a new layer to a scene
    Add {
        /// .hhk project file
        input: String,
        /// Layer name
        name: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// List layers in a scene
    List {
        /// .hhk project file
        input: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// Remove a layer (and its game objects) from a scene
    Remove {
        /// .hhk project file
        input: String,
        /// Layer ID to remove
        layer_id: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// Set layer properties (visible, locked)
    Set {
        /// .hhk project file
        input: String,
        /// Layer ID
        layer_id: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
        /// Set visibility (true/false)
        #[arg(long)]
        visible: Option<bool>,
        /// Set locked (true/false)
        #[arg(long)]
        locked: Option<bool>,
    },
}

// ── GameObject subcommands ────────────────────────────────────────────────────

#[derive(Subcommand)]
enum GameObjectCommands {
    /// Add a new game object to a layer
    Add {
        /// .hhk project file
        input: String,
        /// Game object name
        name: String,
        /// Layer ID to add to
        layer_id: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
        /// Born frame (default: 0)
        #[arg(long, default_value = "0")]
        born_frame: u32,
    },
    /// List game objects in a scene or layer
    List {
        /// .hhk project file
        input: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
        /// Filter by layer ID
        #[arg(long)]
        layer_id: Option<String>,
    },
    /// Remove a game object from the scene
    Remove {
        /// .hhk project file
        input: String,
        /// Game object ID
        go_id: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// Show details of a game object (components + keyframes)
    Show {
        /// .hhk project file
        input: String,
        /// Game object ID
        go_id: String,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// Set a keyframe on a component property
    ///
    /// VALUE FORMAT: <type>:<data>
    ///   float:1.5   int:3   bool:true   string:hello
    ///   vec2:1.0,2.0   vec3:1.0,2.0,3.0   color:1.0,0.5,0.25,1.0
    ///
    /// EASING: linear | step | ease-in | ease-out | ease-in-out | bezier:x1,y1,x2,y2
    #[command(name = "set-kf")]
    SetKeyframe {
        /// .hhk project file
        input: String,
        /// Game object ID
        go_id: String,
        /// Component type name (e.g. Transform, Visual)
        component: String,
        /// Property name (e.g. position, rotation)
        property: String,
        /// Frame number
        frame: u32,
        /// Value in format type:data (e.g. vec2:100.0,200.0)
        value: String,
        /// Easing function (default: linear)
        #[arg(long, default_value = "linear")]
        easing: Option<String>,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// Remove a keyframe from a component property
    #[command(name = "rm-kf")]
    RemoveKeyframe {
        /// .hhk project file
        input: String,
        /// Game object ID
        go_id: String,
        /// Component type name
        component: String,
        /// Property name
        property: String,
        /// Frame number
        frame: u32,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
    /// Interpolate component properties at a given frame and print results
    Interpolate {
        /// .hhk project file
        input: String,
        /// Game object ID
        go_id: String,
        /// Frame number
        frame: u32,
        /// Scene ID (defaults to current scene)
        #[arg(long)]
        scene_id: Option<String>,
    },
}

// ── main ──────────────────────────────────────────────────────────────────────

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

        Commands::Run { script, dry_run } => {
            commands::run::run(script, dry_run)
        }

        Commands::Dump { input, output } => {
            commands::dump::run(input, output)
        }

        Commands::Repl { load } => {
            commands::repl::run(load)
        }

        // Files
        Commands::Files { action } => match action {
            FilesCommands::Import { project, local_file, vfs_path } => {
                commands::files::import(project, local_file, vfs_path)
            }
            FilesCommands::Export { project, vfs_path, local_output } => {
                commands::files::export(project, vfs_path, local_output)
            }
            FilesCommands::List { project, dir, recursive } => {
                commands::files::list(project, dir, recursive)
            }
            FilesCommands::Rm { project, vfs_path } => {
                commands::files::rm(project, vfs_path)
            }
            FilesCommands::Mv { project, old_path, new_path } => {
                commands::files::mv(project, old_path, new_path)
            }
            FilesCommands::Info { project, vfs_path } => {
                commands::files::info(project, vfs_path)
            }
        },

        // Scene
        Commands::Scene { action } => match action {
            SceneCommands::Add { input, name, fps, duration } => {
                commands::scene::add(input, name, fps, duration)
            }
            SceneCommands::List { input } => {
                commands::scene::list(input)
            }
            SceneCommands::SetCurrent { input, scene_id } => {
                commands::scene::set_current(input, scene_id)
            }
            SceneCommands::Remove { input, scene_id } => {
                commands::scene::remove(input, scene_id)
            }
        },

        // Layer
        Commands::Layer { action } => match action {
            LayerCommands::Add { input, name, scene_id } => {
                commands::layer::add(input, name, scene_id)
            }
            LayerCommands::List { input, scene_id } => {
                commands::layer::list(input, scene_id)
            }
            LayerCommands::Remove { input, layer_id, scene_id } => {
                commands::layer::remove(input, layer_id, scene_id)
            }
            LayerCommands::Set { input, layer_id, scene_id, visible, locked } => {
                commands::layer::set_prop(input, layer_id, scene_id, visible, locked)
            }
        },

        // GameObject
        Commands::GameObject { action } => match action {
            GameObjectCommands::Add { input, name, layer_id, scene_id, born_frame } => {
                commands::gameobject::add(input, name, layer_id, scene_id, born_frame)
            }
            GameObjectCommands::List { input, scene_id, layer_id } => {
                commands::gameobject::list(input, scene_id, layer_id)
            }
            GameObjectCommands::Remove { input, go_id, scene_id } => {
                commands::gameobject::remove(input, go_id, scene_id)
            }
            GameObjectCommands::Show { input, go_id, scene_id } => {
                commands::gameobject::show(input, go_id, scene_id)
            }
            GameObjectCommands::SetKeyframe {
                input, go_id, component, property, frame, value, easing, scene_id,
            } => {
                commands::gameobject::set_keyframe(input, go_id, component, property, frame, value, easing, scene_id)
            }
            GameObjectCommands::RemoveKeyframe {
                input, go_id, component, property, frame, scene_id,
            } => {
                commands::gameobject::remove_keyframe(input, go_id, component, property, frame, scene_id)
            }
            GameObjectCommands::Interpolate { input, go_id, frame, scene_id } => {
                commands::gameobject::interpolate(input, go_id, frame, scene_id)
            }
        },
    }
}
